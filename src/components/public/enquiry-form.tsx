import { useId, useState, type FormEvent } from "react";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useHydrated } from "@/lib/use-hydrated";
import { SITE_INFO } from "@/lib/site-info";
import { submitEnquiry } from "@/lib/enquiry.functions";

/*
 * Enquiry form for the public pages. [PLT-019]
 * On submit it asks the server to email the enquiry to the contact address. It says "sent" only when the server confirms.
 * If the server cannot send (no email key yet, or the email service is down), it opens the visitor's own email app
 * with the enquiry written out, and says plainly that nothing has been received yet.
 */
export type EnquiryField = {
  name: string; label: string; required?: boolean; hint?: string;
  kind?: "text" | "email" | "number" | "textarea" | "select"; options?: string[]; autoComplete?: string; rows?: number;
};

const selectClass = "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-base shadow-xs pointer-fine:text-[15px] focus-visible:outline-hidden focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/25";

export function EnquiryForm({ fields, subject, submitLabel }: { fields: EnquiryField[]; subject: string; submitLabel: string }) {
  const uid = useId();
  const hydrated = useHydrated();
  const [values, setValues] = useState<Record<string, string>>({});
  const [state, setState] = useState<"idle" | "sending" | "sent" | "mailto">("idle");
  const [website, setWebsite] = useState("");
  const set = (name: string) => (e: { target: { value: string } }) => { setState("idle"); setValues((v) => ({ ...v, [name]: e.target.value })); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("sending");
    const list = fields.map((f) => ({ label: f.label, value: (values[f.name] ?? "").trim() }));
    try {
      const r = await submitEnquiry({ data: { subject, fields: list, replyTo: values["email"] ?? "", website } });
      if (r.sent) { setState("sent"); return; }
    } catch { /* fall through to the email app */ }
    const body = list.map((f) => `${f.label}: ${f.value || "-"}`).join("\n\n");
    window.location.href = `mailto:${SITE_INFO["contact email"]}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setState("mailto");
  }

  return (
    <form onSubmit={submit} className="relative space-y-5 rounded-xl border border-border/70 bg-card p-5 shadow-card sm:p-6">
      <fieldset disabled={!hydrated || state === "sending"} className="space-y-5">
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
        <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
          <label>Leave this empty<input tabIndex={-1} autoComplete="off" name="website" value={website} onChange={(e) => setWebsite(e.target.value)} /></label>
        </div>
        <Button type="submit" size="lg"><Mail aria-hidden /> {state === "sending" ? "Sending..." : submitLabel}</Button>
        {state === "sent" && (
          <p role="status" className="rounded-md bg-success-soft px-3 py-2.5 text-sm text-success-strong">
            Thank you. We have your enquiry and will reply by email.
          </p>
        )}
        {state === "mailto" && (
          <p role="status" className="rounded-md bg-info-soft px-3 py-2.5 text-sm text-info-strong">
            We could not send this from the website. Your email app should now show your enquiry, ready to send. We have not received anything yet. If no email app opens, write to {SITE_INFO["contact email"]}.
          </p>
        )}
      </fieldset>
    </form>
  );
}
