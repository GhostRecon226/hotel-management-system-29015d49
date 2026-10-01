import { useEffect, useState } from "react";

/**
 * False in the server-rendered page and until React has taken over in the browser.
 * Submit buttons stay disabled until then: a click before that point makes the browser submit the form
 * itself (a page reload to "/auth?"), and what the user typed is lost. Seen on slow first loads.
 */
export function useHydrated() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
