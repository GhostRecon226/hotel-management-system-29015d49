import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Bell, BedDouble, BarChart3, CalendarDays, ConciergeBell, LayoutDashboard, LogOut, Menu,
  Receipt, Settings, CheckCircle2, Shield, Sparkles, Users, Wrench, CalendarClock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatBusinessDate, useAccess } from "@/lib/access";
import { SubscriptionBanner } from "@/components/subscription-banner";
import { cn } from "@/lib/utils";
import { SETUP_PERMS } from "@/lib/setup";
import { APPROVAL_MENU_PERMS } from "@/lib/approvals";
import { NotificationBell } from "@/components/notification-bell";

type Item = { label: string; icon: typeof Bell; perms: string[] | null; to?: "/dashboard" | "/setup" | "/guests" | "/reservations" | "/front-desk" | "/rooms" | "/folios" | "/approvals" | "/housekeeping" | "/maintenance" | "/service-requests" };

// perms: null = everyone; otherwise any one of the keys shows the item.
const MENU: Item[] = [
  { label: "Dashboard", icon: LayoutDashboard, perms: null, to: "/dashboard" },
  { label: "Reservations", icon: CalendarDays, perms: ["res.view"], to: "/reservations" },
  { label: "Front Desk", icon: ConciergeBell, perms: ["fo.view"], to: "/front-desk" },
  { label: "Rooms", icon: BedDouble, perms: ["room.view"], to: "/rooms" },
  { label: "Housekeeping", icon: Sparkles, perms: ["hk.view"], to: "/housekeeping" },
  { label: "Maintenance", icon: Wrench, perms: ["mnt.view", "mnt.ticket.create"], to: "/maintenance" },
  { label: "Service requests", icon: ConciergeBell, perms: ["svc.view", "svc.order.complete"], to: "/service-requests" },
  { label: "Guests", icon: Users, perms: ["guest.view"], to: "/guests" },
  { label: "Folios", icon: Receipt, perms: ["fin.folio.view"], to: "/folios" },
  { label: "Approvals", icon: CheckCircle2, perms: APPROVAL_MENU_PERMS, to: "/approvals" },
  { label: "Reports", icon: BarChart3, perms: ["rpt.operations.view", "rpt.finance.view"] },
  { label: "Setup", icon: Settings, perms: SETUP_PERMS, to: "/setup" },
  { label: "Admin", icon: Shield, perms: ["adm.user.manage", "adm.role.manage", "adm.audit.view"] },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { canAny, ctx } = useAccess();
  const items = MENU.filter((m) => !m.perms || canAny(m.perms));
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-4 flex items-center gap-2.5 px-2 py-1">
        <div className="grid size-9 shrink-0 place-items-center rounded-md bg-sidebar-primary text-sm font-bold text-sidebar-primary-foreground">HD</div>
        <div className="min-w-0">
          <div className="text-base font-semibold text-sidebar-primary">Hotel Desk</div>
          <div className="truncate text-xs text-sidebar-foreground/70">{ctx.tenant?.name}</div>
        </div>
      </div>
      {items.map((m) => {
        const Icon = m.icon;
        const cls = "flex h-11 items-center gap-3 rounded-md px-3 text-[15px]";
        return m.to ? (
          <Link key={m.label} to={m.to} onClick={onNavigate}
            className={cn(cls, "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground")}
            activeProps={{ className: "bg-sidebar-accent font-medium !text-sidebar-accent-foreground shadow-[inset_3px_0_0_var(--sidebar-primary)]" }}>
            <Icon className="h-5 w-5" /> {m.label}
          </Link>
        ) : (
          <span key={m.label} className={cn(cls, "cursor-not-allowed text-sidebar-foreground/45")} title="Coming soon">
            <Icon className="h-5 w-5" /> {m.label}
            <span className="ml-auto text-[11px] uppercase tracking-wide">Soon</span>
          </span>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ctx, property, setPropertyId } = useAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const properties = ctx.properties ?? [];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden h-screen w-60 shrink-0 bg-sidebar lg:block">
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b bg-card px-3 sm:px-5">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0"><Nav onNavigate={() => setOpen(false)} /></SheetContent>
          </Sheet>

          {properties.length > 0 && (
            <Select value={property?.id ?? ""} onValueChange={setPropertyId}>
              <SelectTrigger className="w-44 sm:w-60" aria-label="Property"><SelectValue placeholder="Property" /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {property && (
            <div className="hidden h-11 items-center gap-2 rounded-md bg-primary-soft px-3 text-[15px] text-primary-strong sm:flex" title="Business date">
              <CalendarClock className="h-5 w-5" />
              <span>Business date</span>
              <span className="font-semibold tabular">{formatBusinessDate(property.business_date)}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-2 px-2">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                    {(ctx.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-32 truncate text-sm md:inline">{ctx.profile?.full_name}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{ctx.profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{ctx.tenant?.name}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="h-10" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <SubscriptionBanner />
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
