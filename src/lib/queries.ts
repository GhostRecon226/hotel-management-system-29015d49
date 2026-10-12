// The two lookups the route guards run before any screen shows. They live apart from the screens so the
// first page load does not pull in the sign-in library or the screen code. The library loads when a lookup runs.
import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MyContext } from "@/lib/access";

/* eslint-disable @typescript-eslint/no-explicit-any */
async function rpc<T>(name: string, args: Record<string, unknown> = {}): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as T;
}

export const myContextQuery = queryOptions({
  queryKey: ["my-context"],
  queryFn: async (): Promise<MyContext> => rpc<MyContext>("my_context"),
  staleTime: 60_000,
});

export const whoamiQuery = {
  queryKey: ["platform", "whoami"],
  queryFn: () => rpc<{ operator: boolean; mfa: boolean }>("platform_whoami", {}),
};
