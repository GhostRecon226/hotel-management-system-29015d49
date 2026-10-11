import { useInfiniteQuery } from "@tanstack/react-query";

/** A list that loads one page at a time. A full page means there may be more. */
export function usePaged<T>(
  key: readonly unknown[], pageSize: number, fetchPage: (offset: number, limit: number) => Promise<T[]>, enabled = true,
) {
  const q = useInfiniteQuery({
    queryKey: [...key, "paged", pageSize], enabled,
    initialPageParam: 0,
    queryFn: ({ pageParam }) => fetchPage(pageParam, pageSize),
    getNextPageParam: (last, all) => (last.length >= pageSize ? all.length * pageSize : undefined),
  });
  return {
    data: (q.data?.pages.flat() ?? []) as T[],
    isLoading: q.isLoading,
    isError: q.isError,
    hasMore: !!q.hasNextPage,
    loadMore: () => { void q.fetchNextPage(); },
    isLoadingMore: q.isFetchingNextPage,
  };
}
