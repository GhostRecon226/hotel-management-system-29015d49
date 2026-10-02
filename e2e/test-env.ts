// Fixed test-only values for the browser tests' dev server. Not secrets: they only work against the local
// stand-in for Resend and local Supabase.
export const TEST_CRON_SECRET = "local-test-cron-secret";
export const TEST_RESEND_PORT = 54399;
export const TEST_FROM_EMAIL = "Hotel Desk <no-reply@hotel.test>";
