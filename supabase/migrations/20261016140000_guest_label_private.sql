-- RPT-008 follow-up: the name helper behind the Latest activity feed was granted to signed-in users by mistake.
-- Helpers stay private (rule 3). recent_activity is security definer and still works without the grant.
revoke all on function app.guest_label(public.guests) from public, anon, authenticated;
