#!/usr/bin/env bash
# Runs the database tests on LOCAL Supabase (Docker), never on a real project.
#   0. Upgrade test: a hotel made before the newest migrations gets their rules (SKIP_UPGRADE=1 to skip).
#   1. Rebuilds the local database from supabase/migrations (supabase db reset).
#   2. Loads the test helpers and the shared fixtures.
#   3. Runs every supabase/tests/db/[1-9]*.sql file. Each file rolls back at the end.
# Every check prints "ok" or "not ok" and the run carries on, so you see every failure.
# Usage: scripts/test-db.sh            (SKIP_RESET=1 to reuse the current database)
set -uo pipefail
cd "$(dirname "$0")/.."
export SUPABASE_PROJECT_ID=hotel-desk
DB_URL=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
case "$DB_URL" in *127.0.0.1*|*localhost*) ;; *) echo "Refusing to run tests against a non-local database."; exit 2;; esac

run() { psql "$DB_URL" -X -q -v ON_ERROR_STOP=1 "$@"; }

pass=0; fail=0; failures=""

# Upgrade test: build only the migrations the live project already has, create a hotel, apply the rest,
# and check that hotel. UPGRADE_FROM is the last migration applied to the live project.
UPGRADE_FROM=${UPGRADE_FROM:-20260930160100}
if [ "${SKIP_UPGRADE:-0}" != "1" ]; then
  supabase db reset --local --version "$UPGRADE_FROM" >/tmp/hotel-desk-reset.log 2>&1 || { cat /tmp/hotel-desk-reset.log; exit 2; }
  run -f supabase/tests/upgrade/before.sql >/dev/null || { echo "Upgrade test set-up failed."; exit 2; }
  supabase migration up --local >/tmp/hotel-desk-upgrade.log 2>&1 || { cat /tmp/hotel-desk-upgrade.log; exit 2; }
  out=$(psql "$DB_URL" -X -q -f supabase/tests/upgrade/after.sql 2>&1)
  p=$(grep -c "NOTICE:  ok - " <<<"$out"); n=$(grep -c "NOTICE:  not ok - " <<<"$out")
  pass=$((pass + p)); fail=$((fail + n))
  printf "%-40s %4d ok  %4d not ok\n" "upgrade (from $UPGRADE_FROM)" "$p" "$n"
  if [ "$n" -gt 0 ]; then failures+=$(grep "NOTICE:  not ok - " <<<"$out" | sed "s/.*NOTICE:  not ok - /  upgrade: /")$'\n'; fi
fi

if [ "${SKIP_RESET:-0}" != "1" ]; then
  supabase db reset --local >/tmp/hotel-desk-reset.log 2>&1 || { cat /tmp/hotel-desk-reset.log; exit 2; }
fi
run -f supabase/tests/db/00_helpers.sql >/dev/null || exit 2
fx=$(run -f supabase/tests/db/01_fixtures.sql 2>&1) || { echo "$fx" | grep -E "ERROR|not ok"; echo "Fixtures failed."; exit 2; }
if grep -qE "not ok|ERROR" <<<"$fx"; then echo "$fx" | grep -E "ERROR|not ok"; echo "Fixtures failed."; exit 2; fi

for f in supabase/tests/db/[1-9]*.sql; do
  out=$(psql "$DB_URL" -X -q -f "$f" 2>&1)
  p=$(grep -c "NOTICE:  ok - " <<<"$out")
  n=$(grep -c "NOTICE:  not ok - " <<<"$out")
  e=$(grep "ERROR:" <<<"$out" | grep -v "current transaction is aborted")
  ec=$(grep -c . <<<"$e")
  pass=$((pass + p)); fail=$((fail + n + ec))
  printf "%-40s %4d ok  %4d not ok\n" "$(basename "$f")" "$p" "$((n + ec))"
  if [ "$n" -gt 0 ]; then failures+=$(grep "NOTICE:  not ok - " <<<"$out" | sed "s/.*NOTICE:  not ok - /  $(basename "$f" .sql): /")$'\n'; fi
  if [ "$ec" -gt 0 ]; then failures+=$(sed "s/^/  $(basename "$f" .sql): FILE ERROR /" <<<"$e")$'\n'; fi
done

# Last-room load test: many database sessions book at the same moment (needs the committed fixtures above).
out=$(DB_URL="$DB_URL" bash supabase/tests/concurrency/last_room.sh 2>&1)
p=$(grep -c "^ok - " <<<"$out"); n=$(grep -c "^not ok - " <<<"$out")
pass=$((pass + p)); fail=$((fail + n))
printf "%-40s %4d ok  %4d not ok\n" "concurrency/last_room" "$p" "$n"
if [ "$n" -gt 0 ]; then failures+=$(grep -v "^ok - " <<<"$out" | sed "s/^/  last_room: /")$'\n'; fi
if [ "$p" -eq 0 ] && [ "$n" -eq 0 ]; then fail=$((fail + 1)); failures+="  last_room: produced no results"$'\n'; fi

# Requirement register (docs/requirements.csv): every test id has a row. Part of the full run, not of the build.
reg=$(node scripts/check-requirements.mjs 2>&1)
if [ $? -eq 0 ]; then
  printf "%-40s %4d ok  %4d not ok\n" "requirement register" 1 0; pass=$((pass + 1))
else
  printf "%-40s %4d ok  %4d not ok\n" "requirement register" 0 1; fail=$((fail + 1))
  failures+=$(sed "s/^/  requirement register: /" <<<"$reg")$'\n'
fi

echo
if [ "$fail" -eq 0 ]; then
  echo "ALL OK ($pass checks)"
else
  echo "FAILURES:"
  printf "%s" "$failures"
  echo
  echo "$pass ok, $fail not ok"
  exit 1
fi
