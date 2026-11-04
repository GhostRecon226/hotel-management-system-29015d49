/*
 * The hero picture: a drawn hotel. Windows use the champagne gold of the marketing artwork (never used in app screens).
 * Motion is plain CSS in theme.css (.hs-*), and only runs when the visitor allows motion. Without it, the final picture shows.
 */
const GOLD = "oklch(0.88 0.09 85)";
const GOLD_EDGE = "oklch(0.7 0.1 80)";
const COLS = [138, 198, 258, 318];
const ROWS = [120, 190];

export function HotelScene() {
  let n = 0;
  return (
    <svg data-hotel-scene viewBox="0 0 520 380" role="img" aria-label="Drawing of a hotel building with its windows lit" className="h-auto w-full">
      <ellipse cx="260" cy="338" rx="236" ry="28" className="fill-primary-soft" />
      <rect x="110" y="94" width="300" height="236" rx="8" className="hs-fade fill-card" />
      <rect x="110" y="94" width="300" height="236" rx="8" pathLength={1} fill="none" strokeWidth="3" className="hs-draw stroke-primary-strong" />
      <rect x="90" y="62" width="340" height="34" rx="8" className="hs-fade fill-primary-strong" />
      <text x="260" y="85" textAnchor="middle" fontSize="18" fontWeight="600" className="hs-fade fill-primary-foreground" style={{ fontFamily: "var(--font-display-app)" }}>Your hotel</text>
      {ROWS.map((y) => COLS.map((x) => {
        const i = n++;
        return <rect key={`${x}-${y}`} data-window x={x} y={y} width="44" height="52" rx="5" fill={GOLD} stroke={GOLD_EDGE} strokeWidth="2" className="hs-win" style={{ ["--i" as string]: i }} />;
      }))}
      <rect x="232" y="252" width="56" height="78" rx="5" className="hs-fade fill-primary" />
      <circle cx="277" cy="293" r="3.5" className="fill-primary-foreground" />
      <g className="hs-settle">
        <circle cx="64" cy="262" r="14" className="fill-primary" />
        <rect x="51" y="278" width="26" height="52" rx="10" className="fill-primary-strong" />
      </g>
      <g className="hs-settle hs-settle-late">
        <rect x="438" y="288" width="40" height="42" rx="6" className="fill-primary" />
        <path d="M448 288v-8a10 10 0 0120 0v8" fill="none" strokeWidth="4" className="stroke-primary-strong" />
      </g>
    </svg>
  );
}
