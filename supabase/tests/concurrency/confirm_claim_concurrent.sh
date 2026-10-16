#!/usr/bin/env bash
# R1-10 Part A criterion 10 and 4, "two calls running at the same moment" (docs/specs/R1-10-paid-claims-inbox.md, plan section 9).
# One pgTAP transaction cannot show this, so this script opens two psql sessions against the local database.
#
#   Case 1 (two confirms): session 1 confirms a claim and holds its transaction open for HOLD seconds; session 2 confirms the same
#     claim with another request id meanwhile. Session 2 waits on the tutor's receipt counter, then is refused already_handled.
#     One payment, one receipt number.
#   Case 2 (same request id): two sessions confirm one claim with the SAME request id at the same moment. One payment; both calls
#     return the same receipt number.
#   Case 3 (Confirm against Mark paid): session 1 records the whole fee by hand and holds; session 2 confirms the claim on that fee.
#     The fee is never recorded twice; session 2 is refused amount_over_remaining; the receipt numbers have no gap.
#   Case 4 (Mark paid against Confirm), the other way round: session 1 confirms and holds; session 2 records the fee by hand and is
#     refused already_paid.
#   Case 5 (two submissions): two submit_claim calls for one student at the same moment make one claim; the second answers
#     already_pending.
#
# Needs: psql, and the local database from `pnpm db:start` + `pnpm db:reset` (default URL below). It commits real rows
# for one throw-away tutor and deletes that tutor (and so everything under it) when it ends, pass or fail.
# Never point it at staging or production: it refuses any URL that is not a local one.
#
#   supabase/tests/concurrency/confirm_claim_concurrent.sh [database-url]
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
TUTOR='cccccccc-cccc-4ccc-8ccc-0000000000d1'
S1='c1000000-0000-4000-8000-0000000000d1'
S2='c1000000-0000-4000-8000-0000000000d2'
S3='c1000000-0000-4000-8000-0000000000d3'
S4='c1000000-0000-4000-8000-0000000000d4'
S5='c1000000-0000-4000-8000-0000000000d5'
D1='c2000000-0000-4000-8000-0000000000d1'
D2='c2000000-0000-4000-8000-0000000000d2'
D3='c2000000-0000-4000-8000-0000000000d3'
D4='c2000000-0000-4000-8000-0000000000d4'
D5='c2000000-0000-4000-8000-0000000000d5'
C1='c6000000-0000-4000-8000-0000000000d1'
C2='c6000000-0000-4000-8000-0000000000d2'
C3='c6000000-0000-4000-8000-0000000000d3'
C4='c6000000-0000-4000-8000-0000000000d4'
R1='c4000000-0000-4000-8000-0000000000a1'
R2='c4000000-0000-4000-8000-0000000000a2'
R3='c4000000-0000-4000-8000-0000000000a3'
R4='c4000000-0000-4000-8000-0000000000a4'
R5='c4000000-0000-4000-8000-0000000000a5'
R6='c4000000-0000-4000-8000-0000000000a6'
R7='c4000000-0000-4000-8000-0000000000a7'
TOKEN='CncRaceToken_aaaaaaaaaaaa'
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
contains() { # contains <description> <word> <file>
  if grep -q "$2" "$3"; then echo "ok - $1"; else echo "not ok - $1 (no '$2' in the output)"; FAILED=1; fi
}

# A tutor with five students: committed, so the other session can see them.
run -c "delete from auth.users where id = '$TUTOR'" >/dev/null
run <<SQL >/dev/null
insert into auth.users (id, email) values ('$TUTOR', 'claim-concurrency@example.test');
insert into public.students (id, tutor_id, name, pay_token) values
  ('$S1', '$TUTOR', 'Race one',   'CncOneToken_aaaaaaaaaaaaa'),
  ('$S2', '$TUTOR', 'Race two',   'CncTwoToken_aaaaaaaaaaaaa'),
  ('$S3', '$TUTOR', 'Race three', 'CncThreeToken_aaaaaaaaaaa'),
  ('$S4', '$TUTOR', 'Race four',  'CncFourToken_aaaaaaaaaaaa'),
  ('$S5', '$TUTOR', 'Race five',  '$TOKEN');
insert into public.dues (id, tutor_id, student_id, kind, month, amount, due_date) values
  ('$D1', '$TUTOR', '$S1', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('$D2', '$TUTOR', '$S2', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('$D3', '$TUTOR', '$S3', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('$D4', '$TUTOR', '$S4', 'monthly', '2026-10-01', 100000, '2026-10-05'),
  ('$D5', '$TUTOR', '$S5', 'monthly', '2026-10-01', 100000, '2026-10-05');
insert into public.payment_claims (id, tutor_id, student_id, due_id, amount, fee_count, upi_ref) values
  ('$C1', '$TUTOR', '$S1', '$D1', 100000, 1, '900000000001'),
  ('$C2', '$TUTOR', '$S2', '$D2', 100000, 1, '900000000002'),
  ('$C3', '$TUTOR', '$S3', '$D3', 100000, 1, '900000000003'),
  ('$C4', '$TUTOR', '$S4', '$D4', 100000, 1, '900000000004');
insert into public.consents (tutor_id, student_id, notice_version) values ('$TUTOR', '$S5', public.current_notice_version());
SQL

AS_TUTOR="set local \"request.jwt.claims\" to '{\"sub\":\"$TUTOR\",\"role\":\"authenticated\"}';"
TODAY="(now() at time zone 'Asia/Kolkata')::date"

# ---- Case 1: two confirms of one claim, different request ids ------------------------------------------------
( run <<SQL > "$DIR/s1.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select confirmed_receipt_from from public.confirm_claim('$C1', '$R1');
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
select confirmed_receipt_from from public.confirm_claim('$C1', '$R2');
commit;
SQL
) &
P2=$!
wait $P1; wait $P2
WAITED=$(( $(date +%s) - START ))

check "case 1: one payment for the claim" "1" "$(run -c "select count(*) from public.payments where tutor_id = '$TUTOR' and due_id = '$D1'")"
check "case 1: session 1 got receipt number 1" "1" "$(head -n 1 "$DIR/s1.out")"
contains "case 1: session 2 was refused already_handled" "already_handled" "$DIR/s2.out"
if [ "$WAITED" -ge $(( HOLD - 2 )) ]; then echo "ok - case 1: session 2 waited ${WAITED}s for session 1 (the lock held)"; else echo "not ok - case 1: session 2 did not wait (${WAITED}s)"; FAILED=1; fi
check "case 1: the fee was charged once" "100000" "$(run -c "select amount_paid from public.dues where id = '$D1'")"
check "case 1: the counter is at 1" "1" "$(run -c "select last_no from public.receipt_counters where tutor_id = '$TUTOR'")"

# ---- Case 2: the same request id twice at the same moment -----------------------------------------------------
( run <<SQL > "$DIR/s3.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select confirmed_receipt_from from public.confirm_claim('$C2', '$R3');
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
select confirmed_receipt_from from public.confirm_claim('$C2', '$R3');
commit;
SQL
) &
P4=$!
wait $P3; wait $P4

check "case 2: one payment for the claim" "1" "$(run -c "select count(*) from public.payments where tutor_id = '$TUTOR' and due_id = '$D2'")"
check "case 2: both calls returned receipt number 2" "2,2" "$(head -n 1 "$DIR/s3.out"),$(head -n 1 "$DIR/s4.out")"
check "case 2: the counter is at 2" "2" "$(run -c "select last_no from public.receipt_counters where tutor_id = '$TUTOR'")"

# ---- Case 3: Confirm against Mark paid on the same fee (Mark paid first) --------------------------------------
( run <<SQL > "$DIR/s5.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select receipt_no from public.record_payment('$D3', 100000, 'cash', $TODAY, '$R4');
select pg_sleep($HOLD);
commit;
SQL
) &
P5=$!
sleep 1
( run <<SQL > "$DIR/s6.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select confirmed_receipt_from from public.confirm_claim('$C3', '$R5');
commit;
SQL
) &
P6=$!
wait $P5; wait $P6

check "case 3: Mark paid got receipt number 3" "3" "$(head -n 1 "$DIR/s5.out")"
contains "case 3: Confirm was refused amount_over_remaining" "amount_over_remaining" "$DIR/s6.out"
check "case 3: exactly the fee was recorded, once" "100000" "$(run -c "select coalesce(sum(amount), 0) from public.payments where tutor_id = '$TUTOR' and due_id = '$D3'")"
check "case 3: the claim is still pending" "pending" "$(run -c "select status from public.payment_claims where id = '$C3'")"
check "case 3: the counter is at 3 (no number was used by the loser)" "3" "$(run -c "select last_no from public.receipt_counters where tutor_id = '$TUTOR'")"

# ---- Case 4: Mark paid against Confirm (Confirm first) --------------------------------------------------------
( run <<SQL > "$DIR/s7.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select confirmed_receipt_from from public.confirm_claim('$C4', '$R6');
select pg_sleep($HOLD);
commit;
SQL
) &
P7=$!
sleep 1
( run <<SQL > "$DIR/s8.out" 2>&1
begin;
set local role authenticated;
$AS_TUTOR
select receipt_no from public.record_payment('$D4', 100000, 'cash', $TODAY, '$R7');
commit;
SQL
) &
P8=$!
wait $P7; wait $P8

check "case 4: Confirm got receipt number 4" "4" "$(head -n 1 "$DIR/s7.out")"
contains "case 4: Mark paid was refused already_paid" "already_paid" "$DIR/s8.out"
check "case 4: exactly the fee was recorded, once" "100000" "$(run -c "select coalesce(sum(amount), 0) from public.payments where tutor_id = '$TUTOR' and due_id = '$D4'")"
check "case 4: the receipt numbers have no gap" "1,2,3,4" "$(run -c "select string_agg(receipt_no::text, ',' order by receipt_no) from public.payments where tutor_id = '$TUTOR'")"

# ---- Case 5: two submissions for one student at the same moment ----------------------------------------------
( run <<SQL > "$DIR/s9.out" 2>&1
begin;
select public.submit_claim('$TOKEN', '911111111111', null);
select pg_sleep(2);
commit;
SQL
) &
P9=$!
sleep 1
( run <<SQL > "$DIR/s10.out" 2>&1
select public.submit_claim('$TOKEN', '922222222222', null);
SQL
) &
P10=$!
wait $P9; wait $P10

check "case 5: one claim was made" "1" "$(run -c "select count(*) from public.payment_claims where student_id = '$S5'")"
check "case 5: the first answered ok" "ok" "$(head -n 1 "$DIR/s9.out")"
check "case 5: the second answered already_pending" "already_pending" "$(head -n 1 "$DIR/s10.out")"

if [ "$FAILED" -ne 0 ]; then
  echo "FAILED"; cat "$DIR"/s*.out; exit 1
fi
echo "all concurrency checks passed"
