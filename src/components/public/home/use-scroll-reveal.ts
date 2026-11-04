import { useEffect } from "react";

/*
 * Scroll reveals for the home page: anything marked data-reveal that starts below the fold fades up once as it comes into view.
 * The page is complete without this: content shows from the first paint, and the hidden start state is added only
 * after the page has started, only below the fold, and never for visitors who prefer reduced motion.
 * --i on an item staggers it (80 ms a step). Plain CSS (see .rv-pre in src/theme.css); no animation library.
 */
export function useScrollReveal() {
  useEffect(() => {
    if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) {
        const el = e.target;
        el.classList.add("rv-in");
        // Once it has settled, drop both classes so hover effects on the same element run at their own speed.
        el.addEventListener("transitionend", () => el.classList.remove("rv-pre", "rv-in"), { once: true });
        io.unobserve(el);
      }
    }, { rootMargin: "0px 0px -8% 0px" });
    for (const el of document.querySelectorAll("[data-reveal]")) {
      if (el.getBoundingClientRect().top > window.innerHeight * 0.92) { el.classList.add("rv-pre"); io.observe(el); }
    }
    return () => io.disconnect();
  }, []);
}
