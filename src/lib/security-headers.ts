// Security headers sent with every page and API answer on the live site. [PLT-020]
// They stop other sites from framing Zikora, stop browsers guessing file types, limit what is sent to other sites
// and switch off phone features Zikora does not use. The camera stays allowed for the same site (ID and ticket photos).
// HSTS is already sent by Vercel. A full script policy (CSP script-src) is left out on purpose: the app needs inline
// scripts to start, so a strict one would break every page. This smaller policy blocks framing and form hijacking only.
export const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(self), microphone=(), geolocation=(), payment=(), usb=()",
  "Content-Security-Policy": "frame-ancestors 'none'; base-uri 'self'; object-src 'none'; form-action 'self'",
};
