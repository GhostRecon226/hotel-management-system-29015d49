import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DEFINITIONS } from "@/lib/reports";

export function DefinitionsBox() {
  return (
    <Card>
      <CardHeader><CardTitle>Definitions</CardTitle></CardHeader>
      <CardContent>
        <dl className="grid gap-3 sm:grid-cols-2">
          {DEFINITIONS.map((d) => (
            <div key={d.term}>
              <dt className="font-medium">{d.term}</dt>
              <dd className="text-sm text-muted-foreground">{d.text}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">Figures for a date are saved when that business date closes. Today's figures appear after tonight's roll.</p>
      </CardContent>
    </Card>
  );
}
