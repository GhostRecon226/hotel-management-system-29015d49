import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Bell, BedDouble, BarChart3, CalendarDays, ConciergeBell, KeyRound, LayoutDashboard, LogOut, Menu,
  Receipt, Settings, CheckCircle2, Shield, Sparkles, Users, Wallet, Wrench, CalendarClock, Building2, Printer,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { formatBusinessDate, useAccess } from "@/lib/access";
import { SubscriptionBanner, TrialCard } from "@/components/subscription-banner";
import { cn } from "@/lib/utils";
import { SETUP_PERMS } from "@/lib/setup";
import { APPROVAL_MENU_PERMS } from "@/lib/approvals";
import { SHIFT_PERMS } from "@/lib/cashier";
import { NotificationBell } from "@/components/notification-bell";
import { BrandLogo } from "@/components/brand-logo";
import { ChangePasswordDialog } from "@/components/change-password-dialog";
import { OfflineBanner } from "@/components/offline-banner";

type Item = { label: string; icon: typeof Bell; perms: string[] | null; to?: "/dashboard" | "/setup" | "/guests" | "/reservations" | "/front-desk" | "/rooms" | "/folios" | "/cashier" | "/approvals" | "/housekeeping" | "/maintenance" | "/service-requests" | "/reports" | "/admin" | "/group" | "/downtime" };

// perms: null = everyone; otherwise any one of the keys shows the item.
const MENU: Item[] = [
  { label: "Dashboard", icon: LayoutDashboard, perms: null, to: "/dashboard" },
  { label: "All branches", icon: Building2, perms: ["rpt.group.view"], to: "/group" },
  { label: "Reservations", icon: CalendarDays, perms: ["res.view"], to: "/reservations" },
  { label: "Front Desk", icon: ConciergeBell, perms: ["fo.view"], to: "/front-desk" },
  { label: "Downtime pack", icon: Printer, perms: ["fo.view"], to: "/downtime" },
  { label: "Rooms", icon: BedDouble, perms: ["room.view"], to: "/rooms" },
  { label: "Housekeeping", icon: Sparkles, perms: ["hk.view"], to: "/housekeeping" },
  { label: "Maintenance", icon: Wrench, perms: ["mnt.view", "mnt.ticket.create"], to: "/maintenance" },
  { label: "Service requests", icon: ConciergeBell, perms: ["svc.view", "svc.order.complete"], to: "/service-requests" },
  { label: "Guests", icon: Users, perms: ["guest.view"], to: "/guests" },
  { label: "Folios", icon: Receipt, perms: ["fin.folio.view"], to: "/folios" },
  { label: "Cashier shift", icon: Wallet, perms: SHIFT_PERMS, to: "/cashier" },
  { label: "Approvals", icon: CheckCircle2, perms: APPROVAL_MENU_PERMS, to: "/approvals" },
  { label: "Reports", icon: BarChart3, perms: ["rpt.operations.view", "rpt.finance.view"], to: "/reports" },
  { label: "Setup", icon: Settings, perms: SETUP_PERMS, to: "/setup" },
  { label: "Admin", icon: Shield, perms: ["adm.user.manage", "adm.role.manage", "adm.audit.view", "fin.nightaudit.run"], to: "/admin" },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { canAny, ctx } = useAccess();
  const items = MENU.filter((m) => !m.perms || canAny(m.perms));
  return (
    <nav className="flex h-full flex-col px-4 pb-4 pt-5">
      <div className="mb-5 px-2">
        <BrandLogo onDark className="h-9 w-auto" />
        <div className="mt-1.5 truncate text-xs text-sidebar-foreground/70">{ctx.tenant?.name}</div>
      </div>
      <div className="-mx-1 flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-1">
        {items.map((m) => {
          const Icon = m.icon;
          const cls = "group flex h-10 shrink-0 items-center gap-3 rounded-xl px-3 text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-sidebar-ring/40";
          return m.to ? (
            <Link key={m.label} to={m.to} onClick={onNavigate}
              className={cn(cls, "text-sidebar-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground")}
              activeProps={{ className: "bg-sidebar-accent font-semibold !text-sidebar-accent-foreground" }}>
              <Icon className="size-[18px] shrink-0 group-data-[status=active]:text-sidebar-primary" /> {m.label}
            </Link>
          ) : (
            <span key={m.label} className={cn(cls, "cursor-not-allowed text-sidebar-foreground/45")} title="Coming soon">
              <Icon className="size-[18px]" /> {m.label}
              <span className="ml-auto text-[11px] uppercase tracking-wide">Soon</span>
            </span>
          );
        })}
      </div>
      <div className="mt-4"><TrialCard /></div>
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { ctx, property, setPropertyId } = useAccess();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const properties = ctx.properties ?? [];

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="flex min-h-screen bg-background">
      <aside className="sticky top-0 hidden print:!hidden h-screen w-60 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 print:hidden items-center gap-3 bg-background/85 px-3 backdrop-blur-md sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 border-0 bg-sidebar p-0"><Nav onNavigate={() => setOpen(false)} /></SheetContent>
          </Sheet>

          {properties.length > 0 && (
            <Select value={property?.id ?? ""} onValueChange={setPropertyId}>
              <SelectTrigger className="h-10 w-44 rounded-full border-border bg-card px-4 font-semibold sm:w-56" aria-label="Property"><SelectValue placeholder="Property" /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {property && (
            <div className="hidden h-10 items-center gap-2 whitespace-nowrap rounded-full bg-primary-soft px-4 text-sm text-primary-strong sm:flex" title="Business date">
              <CalendarClock className="size-[18px]" />
              <span className="sr-only xl:not-sr-only">Business date</span>
              <span className="font-semibold tabular">{formatBusinessDate(property.business_date)}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-11 gap-2.5 rounded-full py-1 pl-1 pr-3">
                  <span className="flex size-9 items-center justify-center rounded-full bg-accent-fill text-sm font-bold text-primary-foreground">
                    {(ctx.profile?.full_name ?? "?").slice(0, 1).toUpperCase()}
                  </span>
                  <span className="hidden max-w-40 text-left leading-tight md:block">
                    <span className="block truncate text-sm font-semibold">{ctx.profile?.full_name}</span>
                    <span className="block truncate text-xs font-normal text-muted-foreground">{ctx.tenant?.name}</span>
                  </span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuLabel className="font-normal">
                  <div className="text-sm font-medium">{ctx.profile?.full_name}</div>
                  <div className="text-xs text-muted-foreground">{ctx.tenant?.name}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="h-10" onClick={() => setPwOpen(true)}><KeyRound className="mr-2 h-4 w-4" /> Change password</DropdownMenuItem>
                <DropdownMenuItem className="h-10" onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <ChangePasswordDialog open={pwOpen} onOpenChange={setPwOpen} />
        <OfflineBanner />
        <SubscriptionBanner />
        <main className="mx-auto w-full max-w-[1440px] flex-1 px-4 pb-10 pt-2 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
