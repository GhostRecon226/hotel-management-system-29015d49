import { useId, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToConfirm } from "@/components/public/to-confirm";
import { useHydrated } from "@/lib/use-hydrated";
import { SITE_INFO } from "@/lib/site-info";

/*
 * Enquiry form for the public pages.
 * Zikora has no inbox or message service behind the website yet, so this form cannot send anything itself.
 * On submit it opens the visitor's own email app with the enquiry written out, addressed to the contact email.
 * It never says "received" or "sent": nothing has been sent until the visitor sends the email.
 * When a real delivery route exists (a verified mailbox or a server function), replace the mailto in `submit`.
 */
export type EnquiryField = {
  name: string; label: string; required?: boolean; hint?: string;
  kind?: "text" | "email" | "number" | "textarea" | "select"; options?: string[]; autoComplete?: string; rows?: number;
};

const selectClass = "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-[15px] shadow-xs focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25";

export function EnquiryForm({ fields, subject, submitLabel }: { fields: EnquiryField[]; subject: string; submitLabel: string }) {
  const uid = useId();
  const hydrated = useHydrated();
  const [values, setValues] = useState<Record<string, string>>({});
  const [opened, setOpened] = useState(false);
  const set = (name: string) => (e: { target: { value: string } }) => { setOpened(false); setValues((v) => ({ ...v, [name]: e.target.value })); };

  function submit(e: FormEvent) {
    e.preventDefault();
    const body = fields.map((f) => `${f.label}: ${(values[f.name] ?? "").trim() || "-"}`).join("\n\n");
    const href = `mailto:${SITE_INFO["contact email"]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = href;
    setOpened(true);
  }

  return (
    <form onSubmit={submit} className="space-y-5 rounded-xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
      <fieldset disabled={!hydrated} className="space-y-5">
        <legend className="sr-only">{subject}</legend>
        {fields.map((f) => {
          const id = `${uid}-${f.name}`;
          const hintId = f.hint ? `${id}-hint` : undefined;
          const common = { id, name: f.name, required: f.required, value: values[f.name] ?? "", onChange: set(f.name), "aria-describedby": hintId, autoComplete: f.autoComplete };
          return (
            <div key={f.name} className="space-y-1.5">
              <Label htmlFor={id}>{f.label}{!f.required && <span className="font-normal text-muted-foreground"> (optional)</span>}</Label>
              {f.kind === "textarea"
                ? <Textarea {...common} rows={f.rows ?? 4} maxLength={2000} />
                : f.kind === "select"
                  ? (
                    <select {...common} className={selectClass}>
                      <option value="" disabled={!!f.required}>Choose one</option>
                      {f.options?.map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  )
                  : <Input {...common} type={f.kind === "email" ? "email" : f.kind === "number" ? "number" : "text"} min={f.kind === "number" ? 1 : undefined} maxLength={200} />}
              {f.hint && <p id={hintId} className="text-sm text-muted-foreground">{f.hint}</p>}
            </div>
          );
        })}
        <Button type="submit" size="lg"><Mail aria-hidden /> {submitLabel}</Button>
        <p className="text-sm text-muted-foreground">
          This opens your email app with your enquiry filled in. Nothing is sent until you send that email. If no email app opens, write to <ToConfirm what="contact email" />.
        </p>
        {opened && (
          <p role="status" className="rounded-md bg-info-soft px-3 py-2.5 text-sm text-info-strong">
            Your email app should now show your enquiry, ready to send. Zikora has not received anything yet.
          </p>
        )}
      </fieldset>
    </form>
  );
}
