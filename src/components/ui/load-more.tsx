import { Button } from "@/components/ui/button";

/** Shown under a long list. Hidden when everything is already on screen. */
export function LoadMore({ shown, hasMore, loading, onClick }: { shown: number; hasMore: boolean; loading?: boolean; onClick: () => void }) {
  if (!hasMore) return null;
  return (
    <div className="flex items-center justify-center gap-3 py-4 text-sm text-muted-foreground">
      <span>Showing {shown}</span>
      <Button variant="outline" size="sm" onClick={onClick} disabled={loading}>{loading ? "Loading…" : "Load more"}</Button>
    </div>
  );
}
