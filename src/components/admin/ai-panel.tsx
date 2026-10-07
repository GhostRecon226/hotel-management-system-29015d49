import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { callRpc, Field, NoAccess, SectionHeader, useSetupMutation } from "@/lib/setup";
import { useAccess } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";

export type AiStatus = { enabled: boolean; monthly_cap: number; used: number; remaining: number };
export const AI_STATUS_KEY = ["setup", "ai"];

export function useAiStatus(enabled = true) {
  return useQuery({ queryKey: AI_STATUS_KEY, enabled, queryFn: () => callRpc<AiStatus>("ai_status", {}) });
}

export function AiPanel() {
  const { can } = useAccess();
  const status = useAiStatus();
  const save = useSetupMutation("set_ai_settings", ["ai"], () => "AI settings saved.");
  const [on, setOn] = useState(false);
  const [cap, setCap] = useState("30");
  useEffect(() => { if (status.data) { setOn(status.data.enabled); setCap(String(status.data.monthly_cap)); } }, [status.data]);

  if (!can("adm.ai.manage")) return <NoAccess />;
  return (
    <div className="space-y-4">
      <SectionHeader title="AI helpers" description="Off until you switch it on. AI only writes drafts. Every figure comes from your own data, and no guest names, ID details or card details are sent." />
      <Card>
        <CardContent className="space-y-5 pt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="font-semibold">Owner's morning brief</div>
              <p className="text-sm text-muted-foreground">A short summary of last night and today, on the dashboard.</p>
            </div>
            <Switch checked={on} onCheckedChange={setOn} aria-label="Switch AI helpers on" />
          </div>
          <Field label="Monthly limit" htmlFor="ai-cap" hint="Most drafts your hotel can ask for in a month. A draft that fails does not count.">
            <Input id="ai-cap" className="max-w-32" type="number" min={0} max={1000} value={cap} onChange={(e) => setCap(e.target.value)} />
          </Field>
          <div className="flex items-center gap-4">
            <Button disabled={save.isPending} onClick={() => save.mutate({ p_enabled: on, p_monthly_cap: Number(cap) })}>{save.isPending ? "Saving…" : "Save"}</Button>
            {status.data && <span className="text-sm text-muted-foreground">{status.data.used} used this month, {status.data.remaining} left.</span>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
