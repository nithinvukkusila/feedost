#!/usr/bin/env bash
# R1-9 Part A criteria 9 and 10, "twice at once" (docs/specs/R1-9-parent-pay-page.md, plan section A5).
# One pgTAP transaction cannot show this, so this script opens real psql sessions against the local database.
#
#   Case 1 (consent): session 1 calls record_consent and holds its transaction open for HOLD seconds before commit;
#     session 2 calls record_consent for the same student and version meanwhile. Session 2 must wait on the unique key
#     (not fail with a duplicate error), both calls must answer 'ok', and there must be exactly one consents row.
#   Case 2 (counter): ten sessions call paypage_hit for the same hash at the same moment with a limit of 5. The counter
#     must end at exactly 10 (no lost update), with exactly five true answers and five false ones.
#
# Needs: psql, and the local database from `pnpm db:start` + `pnpm db:reset` (default URL below). It commits real rows
# for one throw-away tutor and one counter row and removes them when it ends, pass or fail.
# Never point it at staging or production: it refuses any URL that is not a local one.
#
#   supabase/tests/concurrency/record_consent_concurrent.sh [database-url]
set -u

URL="${1:-${DATABASE_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}}"
# Parse the host, not the whole string: "user@127.0.0.1@evil" or "?host=..." must not pass.
HOSTPART="${URL#*://}"
HOSTPART="${HOSTPART%%/*}"
HOSTPART="${HOSTPART%%\?*}"
HOSTPART="${HOSTPART##*@}"
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
STUDENT='c1000000-0000-4000-8000-0000000000d1'
TOKEN='ConsentConcTokenAbCdEfGh'
HASH='concurrency-consent-script-hash'
DIR="$(mktemp -d)"
FAILED=0

run() { psql "$URL" -X -q -v ON_ERROR_STOP=1 -At "$@"; }

cleanup() {
  run -c "delete from auth.users where id = '$TUTOR'" >/dev/null 2>&1
  run -c "delete from public.paypage_hits where key_hash = '$HASH'" >/dev/null 2>&1
  rm -rf "$DIR"
}
trap cleanup EXIT

check() { # check <description> <expected> <actual>
  if [ "$2" = "$3" ]; then echo "ok - $1"; else echo "not ok - $1 (expected '$2', got '$3')"; FAILED=1; fi
}

run -c "delete from auth.users where id = '$TUTOR'" >/dev/null
run -c "delete from public.paypage_hits where key_hash = '$HASH'" >/dev/null
run <<SQL >/dev/null
insert into auth.users (id, email) values ('$TUTOR', 'consent-concurrency@example.test');
insert into public.students (id, tutor_id, name, pay_token) values ('$STUDENT', '$TUTOR', 'Consent Concurrency', '$TOKEN');
SQL

VERSION="$(run -c "select public.current_notice_version()")"

# ---- Case 1: the same consent twice at the same moment -------------------------------------------------------
( run <<SQL > "$DIR/s1.out" 2>&1
begin;
set local role service_role;
select public.record_consent('$TOKEN', '$VERSION');
select pg_sleep($HOLD);
commit;
SQL
) &
P1=$!
sleep 1
START=$(date +%s)
( run <<SQL > "$DIR/s2.out" 2>&1
begin;
set local role service_role;
select public.record_consent('$TOKEN', '$VERSION');
commit;
SQL
) &
P2=$!
wait $P1; wait $P2
WAITED=$(( $(date +%s) - START ))

check "case 1: session 1 answered ok" "ok" "$(head -n 1 "$DIR/s1.out")"
check "case 1: session 2 answered ok (no duplicate-key error)" "ok" "$(head -n 1 "$DIR/s2.out")"
check "case 1: exactly one consents row" "1" "$(run -c "select count(*) from public.consents where student_id = '$STUDENT' and notice_version = '$VERSION'")"
check "case 1: the row names the student's tutor" "$TUTOR" "$(run -c "select tutor_id from public.consents where student_id = '$STUDENT'")"
if [ "$WAITED" -ge $(( HOLD - 2 )) ]; then echo "ok - case 1: session 2 waited ${WAITED}s for session 1 (the unique key held)"; else echo "not ok - case 1: session 2 did not wait (${WAITED}s); the two calls did not overlap, so this proved nothing"; FAILED=1; fi

# ---- Case 2: ten counter increments at the same moment ---------------------------------------------------------
for i in 1 2 3 4 5 6 7 8 9 10; do
  ( run -c "set role service_role; select public.paypage_hit('$HASH', 5)" > "$DIR/h$i.out" 2>&1 ) &
done
wait
TRUES=$(cat "$DIR"/h*.out | grep -c '^t$')
FALSES=$(cat "$DIR"/h*.out | grep -c '^f$')
check "case 2: the counter holds exactly 10 (no lost update)" "10" "$(run -c "select coalesce(sum(n), 0) from public.paypage_hits where key_hash = '$HASH'")"
check "case 2: five calls were within the limit" "5" "$TRUES"
check "case 2: five calls were over it" "5" "$FALSES"

if [ "$FAILED" -ne 0 ]; then
  echo "FAILED"; cat "$DIR"/*.out; exit 1
fi
echo "all consent concurrency checks passed"
