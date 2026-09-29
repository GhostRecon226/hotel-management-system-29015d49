-- lovable-cron-fallback-reviewed: existing user-approved 5-minute rollover check (288 runs/day), now recorded in migrations
-- Records the pg_cron job that was originally created outside the migrations.
-- cron.schedule with an existing job name updates it, so this is safe to re-run.
create extension if not exists pg_cron;
select cron.schedule('business-date-rollover', '*/5 * * * *', $$select app.run_due_rollovers()$$);