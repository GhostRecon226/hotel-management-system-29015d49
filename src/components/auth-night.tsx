import { useEffect, useState } from "react";

/*
 * The hotel at night, on the sign-in brand panel. One window per room: gold is occupied, teal is ready, dark is empty.
 * Twenty windows, fifteen lit, so it agrees with the 75% on the home page (Sample Hotel, 20 rooms). Sample figures only;
 * nothing here calls a database. Every couple of seconds one window changes, as a guest checks in or out. The change
 * stops under reduced motion, and the drawing still shows the fifteen lit windows.
 */
type S = "off" | "occ" | "rdy";
const LIT = [0, 1, 3, 4, 5, 6, 7, 9, 10, 12, 13, 14, 16, 17, 19];
const initial = (): S[] => Array.from({ length: 20 }, (_, i) => (LIT.includes(i) ? (i % 7 === 3 ? "rdy" : "occ") : "off"));

export function HotelAtNight() {
  const [wins, setWins] = useState<S[]>(initial);
  const [note, setNote] = useState("Sample Hotel · Sample Data");

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      const i = Math.floor(Math.random() * 20);
      setWins((w) => {
        const next = [...w];
        const wasOn = next[i] !== "off";
        next[i] = wasOn ? "off" : "occ";
        setNote(`Room ${101 + i} ${wasOn ? "checked out" : "checked in"}`);
        return next;
      });
    }, 2400);
    return () => window.clearInterval(id);
  }, []);

  const occupied = wins.filter((w) => w !== "off").length;
  return (
    <div className="w-full max-w-sm">
      <svg viewBox="0 0 360 330" className="block h-auto w-full" role="img"
        aria-label="A hotel front at night. Each window is a room. Gold windows are occupied rooms, teal windows are rooms ready for a guest. Sample data.">
        <g aria-hidden>
          <rect x="30" y="40" width="300" height="250" rx="10" fill="oklch(0.17 0.04 205)" stroke="oklch(1 0 0 / 0.14)" />
          <rect x="20" y="28" width="320" height="16" rx="6" fill="oklch(0.24 0.045 205)" stroke="oklch(1 0 0 / 0.14)" />
          {wins.map((s, i) => (
            <rect key={i} x={52 + (i % 5) * 54} y={62 + Math.floor(i / 5) * 44} width="36" height="28" rx="4"
              className="night-win" data-s={s} style={{ "--i": i } as React.CSSProperties} />
          ))}
          <rect x="152" y="238" width="56" height="52" rx="6" fill="oklch(0.22 0.045 205)" stroke="oklch(1 0 0 / 0.2)" />
          <rect x="160" y="246" width="40" height="44" rx="4" fill="oklch(0.78 0.09 80 / 0.25)" />
          <line x1="0" y1="290" x2="360" y2="290" stroke="oklch(1 0 0 / 0.2)" />
        </g>
      </svg>
      <p className="mt-5 flex items-center gap-2.5 text-sm text-white/80" aria-live="off">
        <span aria-hidden className="night-dot size-2 shrink-0 rounded-full bg-[oklch(0.75_0.11_190)]" />
        <span className="tabular"><span>{occupied}</span> of 20 rooms occupied · {note}</span>
      </p>
    </div>
  );
}
