/**
 * True when this browser holds a saved sign-in. Reads the browser's own storage only: no network call and no
 * database call, so public pages stay static. Used to send signed-in users from "/" to the app and to show
 * "Open the app" instead of "Sign in". The app itself still checks the sign-in properly before showing anything.
 */
export function hasStoredSession() {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const key = window.localStorage.key(i) ?? "";
      if (/^sb-.+-auth-token$/.test(key) && window.localStorage.getItem(key)) return true;
    }
  } catch {
    // storage blocked (private mode): treat as signed out
  }
  return false;
}
