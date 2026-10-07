import { Link } from "@tanstack/react-router";
import { ArrowRight, CheckCircle2, Circle } from "lucide-react";
import { useSetupProgress, type SetupProgress } from "@/lib/setup-progress";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type SetupHref = "/setup/property" | "/setup/room-types" | "/setup/rooms" | "/setup/rates" | "/setup/charges" | "/admin";

function Steps({ data }: { data: SetupProgress }) {
  const next = data.steps.find((s) => !s.done);
  return (
    <ol className="divide-y divide-border/70">
      {data.steps.map((s, i) => (
        <li key={s.key} className="flex items-center gap-3 py-3">
          {s.done
            ? <CheckCircle2 className="size-5 shrink-0 text-success" aria-label="Done" />
            : <Circle className="size-5 shrink-0 text-muted-foreground" aria-label="Not done" />}
          <div className="min-w-0 flex-1">
            <div className={cn("text-sm font-semibold", s.done && "text-muted-foreground")}>{i + 1}. {s.label}</div>
            <div className="text-sm text-muted-foreground">{s.detail}</div>
          </div>
          <Button size="sm" variant={s === next ? "default" : "outline"} asChild>
            <Link to={s.href as SetupHref}>{s.done ? "Review" : "Set up"} <ArrowRight className="ml-1 size-4" /></Link>
          </Button>
        </li>
      ))}
    </ol>
  );
}

/** The full checklist, for the Setup page. */
export function SetupChecklist({ data }: { data: SetupProgress }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Get your hotel ready</CardTitle>
        <p className="text-sm text-muted-foreground">{data.done} of {data.total} steps done. Each step opens the right screen. You can come back any time.</p>
      </CardHeader>
      <CardContent><Steps data={data} /></CardContent>
    </Card>
  );
}

/** A short card for the Dashboard. Shows nothing once setup is complete or the person cannot do setup. */
export function SetupCard() {
  const { data } = useSetupProgress();
  if (!data || data.complete) return null;
  const next = data.steps.find((s) => !s.done);
  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-4 pt-5">
        <div className="min-w-0 flex-1">
          <div className="font-semibold">Finish setting up your hotel: {data.done} of {data.total} done</div>
          <div className="text-sm text-muted-foreground">{next ? `Next: ${next.label}. ${next.detail}.` : ""}</div>
        </div>
        <Button asChild><Link to="/setup">Continue setup</Link></Button>
      </CardContent>
    </Card>
  );
}
