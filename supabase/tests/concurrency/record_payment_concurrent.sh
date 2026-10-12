#!/usr/bin/env bash
# R1-7 Part A criterion 5, "two calls running at the same moment" (docs/specs/R1-7-record-payment.md, risk 2).
# One pgTAP transaction cannot show this, so this script opens two psql sessions against the local database.
#
#   Case 1 (numbering): session 1 records a payment and holds its transaction open for HOLD seconds before commit;
#     session 2 records another payment for the same tutor meanwhile. Session 2 must wait for session 1 (it is
#     blocked on the tutor's counter row), and the two receipts must be numbers 1 and 2.
#   Case 2 (retry): two sessions call record_payment with the SAME request id at the same moment. There must be one
#     payment, both calls must return the same receipt number, and the fee must be charged once.
#
# Needs: psql, and the local database from `pnpm db:start` + `pnpm db:reset` (default URL below). It commits real rows
# for one throw-away tutor and deletes that tutor (and so everything under it) when it ends, pass or fail.
# Never point it at staging or production: it refuses any URL that is not a local one.
#
#   supabase/tests/concurrency/record_payment_concurrent.sh [database-url]
set -u

URL="${1:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}}"
# Parse the host, not the whole string: "user@127.0.0.1@evil" or "?host=..." must not pass.
HOSTPART="${URL#*://}"          # drop the scheme
HOSTPART="${HOSTPART%%/*}"      # drop the path and query
HOSTPART="${HOSTPART%%\?*}"
HOSTPART="${HOSTPART##*@}"      # drop the userinfo (everything up to the last @)
HOST="${HOSTPART%%:*}"
case "$URL" in
  *'?'*|*'%'*) echo "refusing: no query string or escapes in the database URL" >&2; exit 2 ;;
esac
case "$HOST" in
  127.0.0.1|localhost) ;;
  *) echo "refusing: this script only runs against a local database (127.0.0.1 or localhost)" >&2; exit 2 ;;
esac
command -v psql >/dev/null 2>&1 || { echo "psql is not installed" >&2; exit 2; }

HOLD=3
TUTOR='cccccccc-cccc-4ccc-8ccc-0000000000c1'
STUDENT='c1000000-0000-4000-8000-0000000000c1'
DUE1='c2000000-0000-4000-8000-0000000000c1'
DUE2='c2000000-0000-4000-8000-0000000000c2'
DUE3='c2000000-0000-4000-8000-0000000000c3'
REQ_A='c4000000-0000-4000-8000-0000000000a1'
REQ_B='c4000000-0000-4000-8000-0000000000b1'
REQ_C='c4000000-0000-4000-8000-0000000000c1'
DIR="$(mktemp -d)"
FAILED=0

run() { psql "$URL" -X -q -v ON_ERROR_STOP=1 -At "$@"; }

cleanup() {
  run -c "delete from auth.users where id = '$TUTOR'" >/dev/null 2>&1
  rm -rf "$DIR"
}
trap cleanup EXIT

check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "ok - $1"; else echo "not ok - $1 (expected '$2', got '$3')"; FAILED=1; fi
}

# A tutor with one student and three fees (committed, so the other session can see them).
run -c "delete from auth.users where id = '$TUTOR'" >/dev/null
run <<SQL >/dev/null
insert into auth.users (id, email) values ('$TUTOR', 'concurrency@example.test');
insert into public.students (id, tutor_id, name) values ('$STUDENT', '$TUTOR', 'Concurrency');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, due_date) values
  ('$DUE1', '$TUTOR', '$STUDENT', 'monthly', '2026-08-01', 100000, '2026-08-05'),
  ('$DUE2', '$TUTOR', '$STUDENT', 'monthly', '2026-09-01', 100000, '2026-09-05'),
  ('$DUE3', '$TUTOR', '$STUDENT', 'monthly', '2026-10-01', 100000, '2026-10-05');
SQL

AS_TUTOR="set local \"request.jwt.claims\" to '{\"sub\":\"$TUTOR\",\"role\":\"authenticated\"}';"

# ---- Case 1: two payments, one tutor, at the same moment ------------------------------------------------------
( run <<SQL > "$DIR/s1.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select receipt_no from public.record_payment('$DUE1', 1000, 'cash', (now() at time zone 'Asia/Kolkata')::date, '$REQ_A');
select pg_sleep($HOLD);
commit;
SQL
) &
P1=$!
sleep 1
START=$(date +%s)
( run <<SQL > "$DIR/s2.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select receipt_no from public.record_payment('$DUE2', 1000, 'upi', (now() at time zone 'Asia/Kolkata')::date, '$REQ_B');
commit;
SQL
) &
P2=$!
wait $P1; wait $P2
WAITED=$(( $(date +%s) - START ))

check "case 1: the two receipts are numbers 1 and 2" "1,2" "$(run -c "select string_agg(receipt_no::text, ',' order by receipt_no) from public.payments where tutor_id = '$TUTOR'")"
check "case 1: session 1 got number 1" "1" "$(head -n 1 "$DIR/s1.out")"
check "case 1: session 2 got number 2" "2" "$(head -n 1 "$DIR/s2.out")"
if [ "$WAITED" -ge $(( HOLD - 2 )) ]; then echo "ok - case 1: session 2 waited ${WAITED}s for session 1 (the lock held)"; else echo "not ok - case 1: session 2 did not wait (${WAITED}s); it was not blocked by the counter lock"; FAILED=1; fi
check "case 1: the counter is at 2" "2" "$(run -c "select last_no from public.receipt_counters where tutor_id = '$TUTOR'")"

# ---- Case 2: the same request id twice at the same moment ----------------------------------------------------
( run <<SQL > "$DIR/s3.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select receipt_no from public.record_payment('$DUE3', 40000, 'cash', (now() at time zone 'Asia/Kolkata')::date, '$REQ_C');
select pg_sleep(2);
commit;
SQL
) &
P3=$!
sleep 1
( run <<SQL > "$DIR/s4.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select receipt_no from public.record_payment('$DUE3', 40000, 'cash', (now() at time zone 'Asia/Kolkata')::date, '$REQ_C');
commit;
SQL
) &
P4=$!
wait $P3; wait $P4

check "case 2: one payment for the request id" "1" "$(run -c "select count(*) from public.payments where tutor_id = '$TUTOR' and request_id = '$REQ_C'")"
check "case 2: both calls returned receipt number 3" "3,3" "$(head -n 1 "$DIR/s3.out"),$(head -n 1 "$DIR/s4.out")"
check "case 2: the fee was charged once" "40000" "$(run -c "select amount_paid from public.dues where id = '$DUE3'")"
check "case 2: the counter is at 3" "3" "$(run -c "select last_no from public.receipt_counters where tutor_id = '$TUTOR'")"

if [ "$FAILED" -ne 0 ]; then
  echo "FAILED"; cat "$DIR"/s*.out; exit 1
fi
echo "all concurrency checks passed"
