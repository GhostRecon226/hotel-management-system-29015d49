// Small on purpose: the app shell uses this to decide whether to load the sign-in library at all.
/** True when this browser holds a saved Supabase sign-in. */
export function hasSavedSignIn() {
  try {
    for (let i = 0; i < window.localStorage.length; i++) {
      const k = window.localStorage.key(i);
      if (k && /^sb-.+-auth-token$/.test(k)) return true;
    }
  } catch { /* storage blocked */ }
  return false;
}
