#!/usr/bin/env bash
# Last-room load test [NFR-006]. Many desks book at the same moment, in separate database sessions.
# Needs the shared fixtures (committed by scripts/test-db.sh) and runs on LOCAL Supabase only.
# It adds committed bookings far in the future and picks fresh dates each run, so it needs no clean-up.
# Prints "ok - ..." or "not ok - ..." lines, like the other tests.
set -uo pipefail
DB_URL=${DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}
case "$DB_URL" in *127.0.0.1*|*localhost*) ;; *) echo "not ok - refusing to run against a non-local database"; exit 2;; esac
DESKS=${DESKS:-8}
q() { psql "$DB_URL" -X -q -t -A -v ON_ERROR_STOP=1 "$@"; }
ok() { if [ "$1" = "1" ]; then echo "ok - $2"; else echo "not ok - $2"; FAILED=1; fi; }
FAILED=0
TMP=$(mktemp -d); trap 'rm -rf "$TMP"' EXIT

# Fresh three-night window per run, 120 to 380 days ahead (the fixture prices run to 400 days).
OFFSET=$(( (RANDOM % 260) + 120 ))
WIN=$(q -c "select (t.bdate() + $OFFSET)::text")
OUT=$(q -c "select (t.bdate() + $OFFSET + 3)::text")

# The Deluxe room type; the fixtures give it more than one room.
TYPE=$(q -c "select t.id('dlx')::text")
PLAN=$(q -c "select t.id('bar')::text")
GUEST=$(q -c "select t.id('g1')::text")
PROP=$(q -c "select t.id('propA')::text")
FREE=$(q -c "select min(sellable - reserved) from app.availability('$PROP', '$WIN', '$OUT', null) where room_type_id = '$TYPE'")
if [ -z "$FREE" ] || [ "$FREE" -lt 1 ]; then echo "not ok - [NFR-006] could not read free rooms for the test window"; exit 1; fi

# Sell every room but one, as a front desk user, one at a time.
BOOK="select t.login('fdo'); select public.create_reservation('$PROP', %s, '$GUEST', '$WIN', '$OUT', '$TYPE', '$PLAN', 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);"
i=0
while [ "$i" -lt $((FREE - 1)) ]; do # not seq: on macOS "seq 1 0" counts down and books extra rooms
  i=$((i + 1))
  q -c "$(printf "$BOOK" "'race-fill-$OFFSET-$i'")" >/dev/null || { echo "not ok - [NFR-006] set-up booking $i failed"; exit 1; }
done

# One session holds a start line; every desk waits on it, then books the last room with its own key.
hold() { psql "$DB_URL" -X -q -c "select pg_advisory_lock(424242); select pg_sleep($1);" >/dev/null 2>&1; }
race() { # $1 = label, $2.. = key per desk (one per line in file $TMP/keys)
  local label=$1 n=0
  rm -f "$TMP/$label".*
  hold 4 & local holder=$!
  sleep 0.5
  while read -r key; do
    n=$((n + 1))
    ( psql "$DB_URL" -X -q -t -A -c "select pg_advisory_lock_shared(424242); select pg_advisory_unlock_shared(424242);" >/dev/null 2>&1
      psql "$DB_URL" -X -q -t -A -c "$(printf "$BOOK" "'$key'")" >"$TMP/$label.$n.out" 2>"$TMP/$label.$n.err" ) &
  done <"$TMP/keys"
  wait
}

# Race 1: DESKS desks, DESKS different guests, one room left. Exactly one may win.
for i in $(seq 1 $DESKS); do echo "race-a-$OFFSET-$i"; done >"$TMP/keys"
race a
WON=$(cat "$TMP"/a.*.out 2>/dev/null | grep -cE '^[0-9a-f-]{36}$')
REFUSED=$(cat "$TMP"/a.*.err 2>/dev/null | grep -c '^ERROR:.*E_NO_AVAILABILITY')
[ "$WON" = "1" ] && ok 1 "[NFR-006] $DESKS desks race for the last room: exactly one booking wins" || ok 0 "[NFR-006] last room race: $WON won, expected 1"
[ "$REFUSED" = "$((DESKS - 1))" ] && ok 1 "[NFR-006] the other $((DESKS - 1)) desks are refused with E_NO_AVAILABILITY" || ok 0 "[NFR-006] last room race: $REFUSED refused with E_NO_AVAILABILITY, expected $((DESKS - 1))"
OTHER=$(cat "$TMP"/a.*.err 2>/dev/null | grep -c '^ERROR:')
[ "$OTHER" = "$REFUSED" ] && ok 1 "[NFR-006] no desk hit a deadlock or any other error" || { ok 0 "[NFR-006] unexpected errors in the race:"; cat "$TMP"/a.*.err | sort | uniq -c | head -5; }

OVER=$(q -c "select count(*) from app.availability('$PROP', '$WIN', '$OUT', null) a where a.room_type_id = '$TYPE' and a.reserved > a.sellable")
[ "$OVER" = "0" ] && ok 1 "[NFR-006] after the race no night is oversold" || ok 0 "[NFR-006] $OVER nights are oversold after the race"

# Race 2: the same desk retries the same booking at once (a double click). One booking, same answer for all.
OFFSET2=$((OFFSET + 5)); WIN2=$(q -c "select (t.bdate() + $OFFSET2)::text"); OUT2=$(q -c "select (t.bdate() + $OFFSET2 + 2)::text")
BOOK="select t.login('fdo'); select public.create_reservation('$PROP', %s, '$GUEST', '$WIN2', '$OUT2', '$TYPE', '$PLAN', 1, 0, 'confirmed', 'direct', null, null, null, 'none', null, null, null, null);"
for i in $(seq 1 $DESKS); do echo "race-same-$OFFSET2"; done >"$TMP/keys"
race b
IDS=$(cat "$TMP"/b.*.out 2>/dev/null | grep -E '^[0-9a-f-]{36}$' | sort -u | wc -l | tr -d ' ')
ANSWERS=$(cat "$TMP"/b.*.out 2>/dev/null | grep -cE '^[0-9a-f-]{36}$')
ROWS=$(q -c "select count(*) from public.reservations where idempotency_key = 'race-same-$OFFSET2'")
[ "$ROWS" = "1" ] && ok 1 "[NFR-006] $DESKS repeats of one booking leave exactly one reservation" || ok 0 "[NFR-006] repeat race: $ROWS reservations, expected 1"
[ "$IDS" = "1" ] && [ "$ANSWERS" = "$DESKS" ] && ok 1 "[NFR-006] every repeat gets the same reservation back" || ok 0 "[NFR-006] repeat race: $ANSWERS answers, $IDS different reservations"

exit $FAILED
