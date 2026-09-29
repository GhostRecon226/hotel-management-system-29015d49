#!/usr/bin/env bash
# Replays every migration in supabase/migrations on a fresh plain-Postgres database,
# then runs the SQL tests in supabase/tests. Needs Postgres 15+ with btree_gist.
# Usage: DATABASE_URL=postgres://user@host:5432/postgres scripts/check-migrations.sh
# (the target database "hotel_migration_check" is dropped and recreated).
set -euo pipefail
cd "$(dirname "$0")/.."
BASE="${DATABASE_URL:?set DATABASE_URL to a server you can create databases on}"
DB=hotel_migration_check
psql "$BASE" -v ON_ERROR_STOP=1 -q -c "drop database if exists $DB" -c "create database $DB"
URL="${BASE%/*}/$DB"
psql "$URL" -v ON_ERROR_STOP=1 -q -f supabase/tests/local_supabase_stub.sql
for f in supabase/migrations/*.sql; do
  echo "migrate: $f"
  # pg_cron is not in stock Postgres; the stub fakes cron.schedule.
  sed 's/^create extension if not exists pg_cron;/-- pg_cron stubbed/' "$f" | psql "$URL" -v ON_ERROR_STOP=1 -q -1 >/dev/null
done
for t in supabase/tests/*.sql; do
  [ "$(basename "$t")" = local_supabase_stub.sql ] && continue
  echo "test: $t"
  psql "$URL" -v ON_ERROR_STOP=1 -q -f "$t"
done
echo "OK"
