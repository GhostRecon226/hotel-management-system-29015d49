import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  Bell, BedDouble, BarChart3, CalendarDays, ConciergeBell, LayoutDashboard, LogOut, Menu,
  Receipt, Settings, Shield, Sparkles, Users, Wrench, CalendarClock,
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

type Item = { label: string; icon: typeof Bell; perms: string[] | null; to?: "/dashboard" };

// perms: null = everyone; otherwise any one of the keys shows the item.
const MENU: Item[] = [
  { label: "Dashboard", icon: LayoutDashboard, perms: null, to: "/dashboard" },
  { label: "Reservations", icon: CalendarDays, perms: ["res.view"] },
  { label: "Front Desk", icon: ConciergeBell, perms: ["fo.view"] },
  { label: "Rooms", icon: BedDouble, perms: ["room.view"] },
  { label: "Housekeeping", icon: Sparkles, perms: ["hk.view"] },
  { label: "Maintenance", icon: Wrench, perms: ["mnt.view", "mnt.ticket.create"] },
  { label: "Guests", icon: Users, perms: ["guest.view"] },
  { label: "Folios", icon: Receipt, perms: ["fin.folio.view"] },
  { label: "Reports", icon: BarChart3, perms: ["rpt.operations.view", "rpt.finance.view"] },
  { label: "Setup", icon: Settings, perms: ["setup.property.view", "setup.property.edit"] },
  { label: "Admin", icon: Shield, perms: ["adm.user.manage", "adm.role.manage", "adm.audit.view"] },
];

function Nav({ onNavigate }: { onNavigate?: () => void }) {
  const { canAny, ctx } = useAccess();
  const items = MENU.filter((m) => !m.perms || canAny(m.perms));
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className="mb-3 px-2">
        <div className="text-base font-semibold text-sidebar-foreground">Hotel Desk</div>
        <div className="truncate text-xs text-muted-foreground">{ctx.tenant?.name}</div>
      </div>
      {items.map((m) => {
        const Icon = m.icon;
        const cls = "flex items-center gap-3 rounded-md px-3 py-2 text-sm";
        return m.to ? (
          <Link key={m.label} to={m.to} onClick={onNavigate}
            className={cn(cls, "text-sidebar-foreground hover:bg-sidebar-accent")}
            activeProps={{ className: "bg-sidebar-accent font-medium" }}>
            <Icon className="h-4 w-4" /> {m.label}
          </Link>
        ) : (
          <span key={m.label} className={cn(cls, "cursor-not-allowed text-muted-foreground")} title="Coming soon">
            <Icon className="h-4 w-4" /> {m.label}
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
      <aside className="hidden w-56 shrink-0 border-r bg-sidebar lg:block">
        <Nav />
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 items-center gap-3 border-b px-3 sm:px-4">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu"><Menu className="h-5 w-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-60 bg-sidebar p-0"><Nav onNavigate={() => setOpen(false)} /></SheetContent>
          </Sheet>

          {properties.length > 0 && (
            <Select value={property?.id ?? ""} onValueChange={setPropertyId}>
              <SelectTrigger className="h-9 w-44 sm:w-56" aria-label="Property"><SelectValue placeholder="Property" /></SelectTrigger>
              <SelectContent>
                {properties.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {property && (
            <div className="hidden items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm sm:flex" title="Business date">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <span className="text-muted-foreground">Business date</span>
              <span className="font-medium">{formatBusinessDate(property.business_date)}</span>
            </div>
          )}

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" aria-label="Notifications"><Bell className="h-5 w-5" /></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="h-9 gap-2 px-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
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
                <DropdownMenuItem onClick={signOut}><LogOut className="mr-2 h-4 w-4" /> Sign out</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        <SubscriptionBanner />
        <main className="flex-1 p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
