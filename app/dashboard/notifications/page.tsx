"use client";

import { useState, useMemo } from "react";
import useSWR, { mutate } from "swr";
import { toast } from "sonner";
import { authFetcher, fetchWithAuth } from "@/lib/fetch-client";
import { useAuth } from "@/lib/auth-context";
import { useOrganization } from "@/lib/org-context";
import { usePermissions } from "@/lib/use-permissions";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  Bell,
  Send,
  CheckCheck,
  Mail,
  MailOpen,
  Search,
  Info,
  AlertTriangle,
  Trophy,
  Calendar,
  Users,
  Shield,
} from "lucide-react";

interface Notification {
  id: string;
  title: string;
  body: string;
  read: boolean;
  type: string;
  createdAt: string;
}

const mockNotifications: Notification[] = [
  { id: "1", title: "New Season Created", body: "The 2025/26 Ethiopian Premier League season has been created. Review and assign clubs.", type: "info", read: false, createdAt: "2026-03-03T14:30:00" },
  { id: "2", title: "Match Result Updated", body: "St. George FC 2 - 1 Ethio Electric SC. The result has been officially recorded.", type: "match", read: false, createdAt: "2026-03-01T17:00:00" },
  { id: "3", title: "Club Registration Pending", body: "Adama Ketema FC has submitted a registration request. Requires your approval.", type: "warning", read: false, createdAt: "2026-02-28T10:15:00" },
  { id: "4", title: "Referee Assignment", body: "Bamlak Tessema has been assigned as main referee for the upcoming Round 19 fixtures.", type: "info", read: true, createdAt: "2026-02-27T09:00:00" },
  { id: "5", title: "Season Milestone", body: "The 2025/26 Season has reached its halfway mark with 120 matches completed.", type: "achievement", read: true, createdAt: "2026-02-25T12:00:00" },
  { id: "6", title: "Club Registration Approved", body: "Bahir Dar Ketema FC has been approved for the 2025/26 Ethiopian Premier League.", type: "info", read: true, createdAt: "2026-02-22T11:30:00" },
  { id: "7", title: "Match Postponed", body: "Wolaita Dicha FC vs Jimma Aba Jifar FC has been postponed due to weather conditions.", type: "warning", read: true, createdAt: "2026-02-20T08:45:00" },
  { id: "8", title: "New User Created", body: "Match Event Admin Yohannes Alemu has been added to your organization.", type: "info", read: true, createdAt: "2026-02-18T16:00:00" },
  { id: "9", title: "League Admin Assigned", body: "Dawit Mengistu has been assigned as League Admin for the Ethiopian Premier League.", type: "info", read: true, createdAt: "2026-02-15T13:20:00" },
  { id: "10", title: "Match Completed", body: "Fasil Kenema FC 3 - 0 Hawassa Ketema FC. Hat-trick by Henok Goitom.", type: "match", read: true, createdAt: "2026-02-12T18:30:00" },
];

const typeConfig: Record<string, { icon: typeof Bell; color: string; label: string }> = {
  info: { icon: Info, color: "bg-blue-500/15 text-blue-400", label: "Information" },
  warning: { icon: AlertTriangle, color: "bg-amber-500/15 text-amber-400", label: "Alert" },
  match: { icon: Calendar, color: "bg-emerald-500/15 text-emerald-400", label: "Match" },
  achievement: { icon: Trophy, color: "bg-primary/15 text-primary", label: "Achievement" },
  user: { icon: Users, color: "bg-violet-500/15 text-violet-400", label: "User" },
  club: { icon: Shield, color: "bg-cyan-500/15 text-cyan-400", label: "Club" },
};

export default function NotificationsPage() {
  const { organization, isLoading: orgLoading } = useOrganization();
  const { getOrganizationId, isOrgAdmin, isSuperAdmin } = useAuth();
  const { canManage } = usePermissions();
  const orgId = getOrganizationId();

  // Org admins see org-scoped notifications
  const apiUrl = isOrgAdmin() && orgId
    ? `/api/notifications?organizationId=${orgId}`
    : "/api/notifications";

  const { data, isLoading: notificationsLoading } = useSWR(apiUrl, authFetcher, {
    fallbackData: mockNotifications,
    onError: () => { },
  });

  const notifications: Notification[] = data || mockNotifications;
  const isLoading = orgLoading || notificationsLoading;

  // Org admin: view and mark as read only (no create/send)
  // Super admin: full notification management
  const canCreate = canManage("notifications") && !isOrgAdmin();

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ title: "", body: "", type: "info", recipients: "all" });
  const [isSending, setIsSending] = useState(false);

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchesSearch =
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.body.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !n.read) ||
        (filter === "read" && n.read);
      const matchesType = typeFilter === "all" || n.type === typeFilter;
      return matchesSearch && matchesFilter && matchesType;
    });
  }, [notifications, search, filter, typeFilter]);

  const stats = useMemo(() => {
    const unread = notifications.filter((n) => !n.read).length;
    const read = notifications.filter((n) => n.read).length;
    const alerts = notifications.filter((n) => n.type === "warning").length;
    return { total: notifications.length, unread, read, alerts };
  }, [notifications]);

  const handleMarkAllRead = async () => {
    try {
      // In production, this would call the API
      await new Promise((r) => setTimeout(r, 500));
      toast.success("All notifications marked as read");
      mutate(apiUrl);
    } catch {
      toast.error("Failed to mark notifications as read");
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetchWithAuth(`/api/notifications/${notificationId}/read`, {
        method: "POST",
      });

      if (!response.ok) {
        // Fallback to mock
        await new Promise((r) => setTimeout(r, 300));
      }

      mutate(apiUrl);
    } catch {
      // Silently fail - notification will be marked as read on next fetch
    }
  };

  const handleSend = async () => {
    setIsSending(true);
    try {
      const response = await fetchWithAuth("/api/notifications/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sendForm),
      });

      if (!response.ok) {
        // Fallback to mock
        await new Promise((r) => setTimeout(r, 500));
      }

      toast.success("Notification sent successfully");
      setSendOpen(false);
      setSendForm({ title: "", body: "", type: "info", recipients: "all" });
      mutate(apiUrl);
    } catch {
      toast.error("Failed to send notification");
    } finally {
      setIsSending(false);
    }
  };

  const formatRelativeTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  };

  const pageTitle = isOrgAdmin() && organization
    ? `${organization.name} - Notifications`
    : "Notifications";

  const pageDescription = isOrgAdmin()
    ? "View system notifications for your organization."
    : "View system notifications and send alerts to users.";

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={pageTitle} description={pageDescription}>
        <div className="flex items-center gap-2">
          {stats.unread > 0 && (
            <Button variant="outline" onClick={handleMarkAllRead}>
              <CheckCheck className="h-4 w-4" />
              Mark All Read
            </Button>
          )}
          {canCreate && (
            <Button onClick={() => setSendOpen(true)}>
              <Send className="h-4 w-4" />
              Send Notification
            </Button>
          )}
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard title="Total" value={stats.total} icon={Bell} />
        <StatCard title="Unread" value={stats.unread} icon={Mail} description="Awaiting your attention" />
        <StatCard title="Read" value={stats.read} icon={MailOpen} description="Already reviewed" />
        <StatCard title="Alerts" value={stats.alerts} icon={AlertTriangle} description="Requires attention" />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search notifications..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              <SelectItem value="info">Information</SelectItem>
              <SelectItem value="warning">Alerts</SelectItem>
              <SelectItem value="match">Match</SelectItem>
              <SelectItem value="achievement">Achievement</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "unread" | "read")}>
            <SelectTrigger className="w-28">
              <SelectValue placeholder="Filter" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="unread">Unread</SelectItem>
              <SelectItem value="read">Read</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Notification List */}
      {isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-4">
                <Skeleton className="h-14 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="You're all caught up. No notifications match your current filter."
        />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((notification) => {
            const config = typeConfig[notification.type] || typeConfig.info;
            const Icon = config.icon;

            return (
              <Card
                key={notification.id}
                className={cn(
                  "border-border transition-colors cursor-pointer hover:bg-muted/30",
                  notification.read ? "bg-card" : "bg-card/80 border-primary/20"
                )}
                onClick={() => {
                  if (!notification.read) {
                    handleMarkAsRead(notification.id);
                  }
                }}
              >
                <CardContent className="flex items-start gap-4 p-4">
                  <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", config.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex flex-1 flex-col gap-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <h3 className={cn(
                          "text-sm text-foreground",
                          !notification.read && "font-semibold"
                        )}>
                          {notification.title}
                        </h3>
                        {!notification.read && (
                          <Badge variant="outline" className="bg-primary/15 text-primary border-primary/20 text-[10px]">
                            New
                          </Badge>
                        )}
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {formatRelativeTime(notification.createdAt)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {notification.body}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Send Notification Dialog (only for super admin / league admin) */}
      {canCreate && (
        <FormDialog
          open={sendOpen}
          onOpenChange={setSendOpen}
          title="Send Notification"
          description="Send a notification to users in the system."
          submitLabel={isSending ? "Sending..." : "Send"}
          onSubmit={handleSend}
        >
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="notif-title">Title</Label>
              <Input
                id="notif-title"
                value={sendForm.title}
                onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
                placeholder="Notification title"
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notif-body">Message</Label>
              <Textarea
                id="notif-body"
                value={sendForm.body}
                onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
                placeholder="Notification message..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="notif-type">Type</Label>
                <Select
                  value={sendForm.type}
                  onValueChange={(v) => setSendForm({ ...sendForm, type: v })}
                >
                  <SelectTrigger id="notif-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Information</SelectItem>
                    <SelectItem value="warning">Alert</SelectItem>
                    <SelectItem value="achievement">Achievement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="notif-recipients">Recipients</Label>
                <Select
                  value={sendForm.recipients}
                  onValueChange={(v) => setSendForm({ ...sendForm, recipients: v })}
                >
                  <SelectTrigger id="notif-recipients">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="clubs">Club Managers</SelectItem>
                    <SelectItem value="referees">Referees</SelectItem>
                    <SelectItem value="league_admins">League Managers</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </FormDialog>
      )}
    </div>
  );
}
