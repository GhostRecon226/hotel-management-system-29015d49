import { SITE_INFO } from "@/lib/site-info";

/**
 * A public-page detail that is not final. It shows the stand-in text from src/lib/site-info.ts so the site looks complete.
 * If a key has no stand-in, the yellow [TO CONFIRM] mark shows instead.
 * `npm run check:confirm` runs before every production build and fails while any <ToConfirm> is used,
 * so stand-in text can never go live. Preview builds pass.
 */
export function ToConfirm({ what }: { what: string }) {
  const text = SITE_INFO[what];
  if (text) return <>{text}</>;
  return (
    <mark className="rounded-md bg-warning-soft px-1.5 py-0.5 font-semibold text-warning-strong">[TO CONFIRM: {what}]</mark>
  );
}
