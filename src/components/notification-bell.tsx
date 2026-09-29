import { useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useNotifications, type Notification } from "@/lib/approvals";
import { callRpc } from "@/lib/setup";
import { formatDateTime } from "@/lib/reservations";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export function NotificationBell() {
  const { data = [] } = useNotifications();
  const qc = useQueryClient();
  const navigate = useNavigate();
  const unread = data.filter((n) => !n.read_at).length;

  async function open(n: Notification) {
    if (!n.read_at) await callRpc("mark_notification_read", { p_id: n.id });
    qc.invalidateQueries({ queryKey: ["notifications"] });
    if (n.link === "/approvals") navigate({ to: "/approvals" });
    else if (n.link === "/service-requests") navigate({ to: "/service-requests" });
    else if (n.link?.startsWith("/maintenance/")) navigate({ to: "/maintenance/$id", params: { id: n.link.slice(13) } });
    else if (n.link?.startsWith("/housekeeping")) navigate({ to: "/housekeeping/my-tasks" });
  }
  async function readAll() {
    await callRpc("mark_all_notifications_read", {});
    qc.invalidateQueries({ queryKey: ["notifications"] });
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute right-1 top-1 grid min-w-5 place-items-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-destructive-foreground">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <span className="font-medium">Notifications</span>
          {unread > 0 && <Button variant="ghost" size="sm" onClick={readAll}>Mark all as read</Button>}
        </div>
        <div className="max-h-96 overflow-y-auto">
          {data.length === 0 && <p className="p-4 text-sm text-muted-foreground">No notifications.</p>}
          {data.map((n) => (
            <button key={n.id} onClick={() => open(n)}
              className={cn("block w-full border-b px-3 py-3 text-left last:border-0 hover:bg-muted", !n.read_at && "bg-primary-soft")}>
              <span className="block text-sm font-medium">{n.title}</span>
              {n.body && <span className="block text-sm text-muted-foreground">{n.body}</span>}
              <span className="block text-xs text-muted-foreground">{formatDateTime(n.created_at)}</span>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
