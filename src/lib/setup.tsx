import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { FormEvent, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAccess } from "@/lib/access";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/states";
import { formatAmount } from "@/components/ui/money";
import { ShieldOff } from "lucide-react";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Call a database function. Errors come back as "[E_CODE] message". */
export async function callRpc<T = unknown>(name: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await (supabase.rpc as any)(name, args);
  if (error) throw error;
  return data as T;
}

/** List rows of a setup table for the current property (RLS scopes to the hotel). */
export function useSetupList<T>(table: string, order: string, extra?: string) {
  const { property } = useAccess();
  return useQuery({
    queryKey: ["setup", table, property?.id],
    enabled: !!property,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)(table)
        .select(extra ?? "*")
        .eq("property_id", property!.id)
        .order(order);
      if (error) throw error;
      return data as T[];
    },
  });
}

export function useSetupMutation(name: string, invalidate: string[], success?: (data: any) => string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (args: Record<string, unknown>) => callRpc(name, args),
    onSuccess: (data) => {
      invalidate.forEach((t) => qc.invalidateQueries({ queryKey: ["setup", t] }));
      toast.success(success ? success(data) : "Saved.");
    },
    onError: (e) => toast.error(errorMessage(e)),
  });
}

export function formatMoney(amount: number | string | null | undefined, currency = "NGN") {
  return formatAmount(amount, currency);
}

export function FormDialog({
  open, onOpenChange, title, onSubmit, busy, children, submitLabel = "Save", submitDisabled = false,
}: {
  open: boolean; onOpenChange: (o: boolean) => void; title: string;
  onSubmit: () => void; busy: boolean; children: ReactNode; submitLabel?: string; submitDisabled?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <form
          className="space-y-4"
          // stopPropagation: a pop-up opened from inside another form (New guest in the booking form or the
          // walk-in) must not submit that form too. React passes events up through portals.
          onSubmit={(e: FormEvent) => { e.preventDefault(); e.stopPropagation(); onSubmit(); }}
        >
          {children}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || submitDisabled}>{busy ? "Saving…" : submitLabel}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor}>{label}</Label>
      {children}
      {hint && <p className="text-sm text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function StatusText({ active }: { active: boolean }) {
  return active
    ? <Badge variant="success" dot>Active</Badge>
    : <Badge variant="neutral" dot>Inactive</Badge>;
}

export function SectionHeader({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-xl font-semibold">{title}</h2>
        {description && <p className="mt-0.5 text-[15px] text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export const SETUP_PERMS = [
  "setup.property.view", "setup.property.edit", "setup.room.manage", "setup.rate.manage", "setup.tax.manage",
];

export function NoAccess() {
  return <EmptyState icon={ShieldOff} title="No access" description="You do not have permission to manage this. Ask your manager if you need it." />;
}
