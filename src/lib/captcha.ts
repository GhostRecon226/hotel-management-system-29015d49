// Sign-up check (PLT-026). Cloudflare Turnstile gives the browser a one-use token; Supabase checks it before it
// signs anyone up, signs anyone in or sends a reset link. With no site key set (local work, tests) there is no check.
// The site key is public and may sit in a VITE_ value. The secret key lives only in the Supabase dashboard.
export function turnstileSiteKey(): string | undefined {
  return (import.meta.env?.["VITE_TURNSTILE_SITE_KEY"] as string | undefined)?.trim() || undefined;
}

export function captchaEnabled(siteKey: string | undefined = turnstileSiteKey()): boolean {
  return Boolean(siteKey);
}

/** The auth option to send with sign-up, sign-in and reset: the token, or nothing when the check is off. */
export function captchaOptions(token: string | null | undefined, enabled: boolean = captchaEnabled()): { captchaToken: string } | undefined {
  return enabled && token ? { captchaToken: token } : undefined;
}

/** A plain message when the person sends the form before the check has finished, or null when they can go on. */
export function captchaBlock(token: string | null | undefined, enabled: boolean = captchaEnabled()): string | null {
  return enabled && !token ? "One moment, the safety check is still running. Try again in a few seconds." : null;
}
