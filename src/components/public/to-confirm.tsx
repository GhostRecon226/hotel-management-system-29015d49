/**
 * A detail Peter has not confirmed yet. Shown on the page, highlighted, so nobody mistakes it for real text.
 * `npm run check:confirm` (run before every production build) fails while any <ToConfirm> is used in public pages.
 */
export function ToConfirm({ what }: { what: string }) {
  return (
    <mark className="rounded-md bg-warning-soft px-1.5 py-0.5 font-semibold text-warning-strong">[TO CONFIRM: {what}]</mark>
  );
}
