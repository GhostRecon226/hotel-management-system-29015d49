import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Printer } from "lucide-react";
import { useAccess } from "@/lib/access";
import { supabase } from "@/integrations/supabase/client";
import { NoAccess } from "@/lib/setup";
import { formatDay } from "@/lib/reservations";
import { useArrivals, useInHouse } from "@/lib/front-desk";
import { PageHeader } from "@/components/page-header";
import { Button } from "@/components/ui/button";
import { Money } from "@/components/ui/money";
import { RoomName } from "@/components/room-name";

export const Route = createFileRoute("/_authenticated/_app/downtime")({
  head: () => ({ meta: [{ title: "Downtime pack · Zikora" }] }),
  component: Downtime,
});

interface BalanceRow { reservation_id: string; balance: number; currency: string }

// Balance of each booking's main folio, as the database reports it. Display only.
function useMainBalances(propertyId?: string) {
  return useQuery({
    queryKey: ["folios", "downtime-balances", propertyId], enabled: !!propertyId,
    queryFn: async () => {
      const { data, error } = await (supabase.from as any)("v_folio_balances")
        .select("reservation_id,balance,currency").eq("property_id", propertyId).eq("is_main", true).eq("status", "open");
      if (error) throw error;
      return new Map((data as BalanceRow[]).map((b) => [b.reservation_id, b]));
    },
  });
}

const BLANK_LINES = Array.from({ length: 10 }, (_, i) => i);

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section aria-label={title} className="mb-6 break-inside-avoid">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

const th = "border border-border px-2 py-1 text-left text-sm font-semibold";
const td = "border border-border px-2 py-1 text-sm";

function Downtime() {
  const { property, can } = useAccess();
  const arrivals = useArrivals(property?.id);
  const inHouse = useInHouse(property?.id);
  const balances = useMainBalances(property?.id);
  if (!can("fo.view")) return <NoAccess />;

  const today = property?.business_date ?? "";
  const dueToday = (arrivals.data ?? []).filter((a) => a.arrival_date <= today);
  const departures = (inHouse.data ?? []).filter((s) => s.is_departing);
  const bal = (id: string) => {
    const b = balances.data?.get(id);
    return b ? <Money amount={b.balance} currency={b.currency} /> : <span className="block text-right text-muted-foreground">-</span>;
  };

  return (
    <div className="print:text-black">
      <PageHeader
        title="Downtime pack"
        description={`Print this when the internet or the system is down. Business date ${formatDay(today)}. Print it again in the morning.`}
        className="print:hidden"
        actions={<Button onClick={() => window.print()}><Printer className="mr-2 size-4" />Print</Button>}
      />
      <h1 className="mb-1 hidden text-xl font-bold print:block">{property?.name} · Downtime pack · {formatDay(today)}</h1>

      <Section title="Arrivals due">
        <table className="w-full border-collapse"><thead><tr>
          <th className={th}>Booking</th><th className={th}>Guest</th><th className={th}>Phone</th><th className={th}>Room</th>
          <th className={th}>Nights</th><th className={th}>Deposit due</th><th className={th}>Arrived (tick)</th>
        </tr></thead><tbody>
          {dueToday.length === 0 && <tr><td className={td} colSpan={7}>No arrivals due.</td></tr>}
          {dueToday.map((a) => (
            <tr key={a.id}>
              <td className={td}>{a.number}</td><td className={td}>{a.guest_name}</td><td className={td}>{a.guest_phone}</td>
              <td className={td}>{a.room_number ? <RoomName label={a.room_number} /> : a.room_type_code}</td>
              <td className={td}>{a.nights}</td><td className={td}><Money amount={a.deposit_due} currency={a.currency} /></td><td className={td} />
            </tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="In house">
        <table className="w-full border-collapse"><thead><tr>
          <th className={th}>Room</th><th className={th}>Guest</th><th className={th}>Phone</th><th className={th}>Departure</th>
          <th className={th}>Balance</th><th className={th}>Paid / notes</th>
        </tr></thead><tbody>
          {(inHouse.data ?? []).length === 0 && <tr><td className={td} colSpan={6}>No guests in house.</td></tr>}
          {(inHouse.data ?? []).map((s) => (
            <tr key={s.stay_id}>
              <td className={td}><RoomName label={s.room_number} /></td><td className={td}>{s.guest_name}</td><td className={td}>{s.guest_phone}</td>
              <td className={td}>{formatDay(s.departure_date)}</td><td className={td}>{bal(s.reservation_id)}</td><td className={td} />
            </tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Departures due">
        <table className="w-full border-collapse"><thead><tr>
          <th className={th}>Room</th><th className={th}>Guest</th><th className={th}>Balance</th><th className={th}>Paid (method, amount)</th><th className={th}>Keys back</th>
        </tr></thead><tbody>
          {departures.length === 0 && <tr><td className={td} colSpan={5}>No departures due.</td></tr>}
          {departures.map((s) => (
            <tr key={s.stay_id}>
              <td className={td}><RoomName label={s.room_number} /></td><td className={td}>{s.guest_name}</td>
              <td className={td}>{bal(s.reservation_id)}</td><td className={td} /><td className={td} />
            </tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="New guests on paper">
        <table className="w-full border-collapse"><thead><tr>
          <th className={th}>Name</th><th className={th}>Phone</th><th className={th}>ID type and number</th><th className={th}>Room</th>
          <th className={th}>Nights</th><th className={th}>Paid (method, amount)</th><th className={th}>Signed</th>
        </tr></thead><tbody>
          {BLANK_LINES.map((i) => (
            <tr key={i} className="h-10">{Array.from({ length: 7 }, (_, c) => <td key={c} className={td} />)}</tr>
          ))}
        </tbody></table>
      </Section>

      <Section title="Paper routine">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Write every new guest, payment and room change on this sheet. Use one line each.</li>
          <li>Give each guest a numbered paper receipt. Keep the carbon copy.</li>
          <li>Do not promise rooms that are not on this sheet. Check the room list before you assign.</li>
          <li>When the system is back, enter new guests first, then payments, then check-outs. Enter each payment once.</li>
          <li>The cashier counts cash against the paper receipts before the shift closes.</li>
          <li>Tell the manager the time the system went down and the time it came back.</li>
        </ol>
      </Section>
    </div>
  );
}
