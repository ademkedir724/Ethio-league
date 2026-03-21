"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { StatCard } from "@/components/dashboard/stat-card";
import { EmptyState } from "@/components/dashboard/empty-state";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
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
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, Plus, MoreHorizontal, Pencil, Trash2, Check, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

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
  { id: "3", title: "Player Transfer Pending", body: "Abebe Bikila has a pending transfer from St. George FC. Requires your approval.", type: "warning", read: false, createdAt: "2026-02-28T10:15:00" },
  { id: "4", title: "Referee Assignment", body: "Bamlak Tessema has been assigned as main referee for the upcoming Round 19 fixtures.", type: "info", read: true, createdAt: "2026-02-27T09:00:00" },
  { id: "5", title: "Season Milestone", body: "The 2025/26 Season has reached its halfway mark with 120 matches completed.", type: "achievement", read: true, createdAt: "2026-02-25T12:00:00" },
  { id: "6", title: "Club Registration Approved", body: "Bahir Dar Ketema FC has been approved for the 2025/26 Ethiopian Premier League.", type: "info", read: true, createdAt: "2026-02-22T11:30:00" },
  { id: "7", title: "Match Postponed", body: "Wolaita Dicha FC vs Jimma Aba Jifar FC has been postponed due to weather conditions.", type: "warning", read: true, createdAt: "2026-02-20T08:45:00" },
  { id: "8", title: "System Maintenance", body: "Scheduled maintenance will occur on March 5th from 2:00 AM to 4:00 AM EAT.", type: "info", read: true, createdAt: "2026-02-18T16:00:00" },
  { id: "9", title: "New Coach Registered", body: "Gebremedhin Haile has been registered as Head Coach for Fasil Kenema FC.", type: "info", read: true, createdAt: "2026-02-15T13:20:00" },
  { id: "10", title: "Match Completed", body: "Fasil Kenema FC 3 - 0 Hawassa Ketema FC. Hat-trick by Henok Goitom.", type: "match", read: true, createdAt: "2026-02-12T18:30:00" },
];

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  info: { icon: Info, color: "bg-blue-500/15 text-blue-400" },
  warning: { icon: AlertTriangle, color: "bg-amber-500/15 text-amber-400" },
  match: { icon: Calendar, color: "bg-emerald-500/15 text-emerald-400" },
  achievement: { icon: Trophy, color: "bg-primary/15 text-primary" },
};
  message: string;
  type: string;
  recipientGroup: string;
  status: string;
  sentDate: string;
  readCount: number;
  totalRecipients: number;
  createdAt: string;
  createdBy: string;
}

const mockNotifications: Notification[] = [
  { id: "1", title: "Match Rescheduled", message: "The match between FC Addis and Saint George has been rescheduled to next Saturday.", type: "alert", recipientGroup: "clubs", status: "sent", sentDate: "2026-03-20", readCount: 24, totalRecipients: 30, createdAt: "2026-03-20T10:30:00Z", createdBy: "Abebe Kebede" },
  { id: "2", title: "Season Registration Open", message: "The 2026 season registration window is now open. Please register your team before March 31st.", type: "announcement", recipientGroup: "all_clubs", status: "sent", sentDate: "2026-03-18", readCount: 42, totalRecipients: 50, createdAt: "2026-03-18T08:00:00Z", createdBy: "Tigist Haile" },
  { id: "3", title: "New Referee Assignment", message: "You have been assigned as referee for the upcoming league match.", type: "assignment", recipientGroup: "referees", status: "draft", sentDate: "", readCount: 0, totalRecipients: 0, createdAt: "2026-03-21T14:22:00Z", createdBy: "Dawit Mengistu" },
  { id: "4", title: "Payment Reminder", message: "Please submit your team's registration fees before the deadline.", type: "reminder", recipientGroup: "clubs", status: "sent", sentDate: "2026-03-15", readCount: 18, totalRecipients: 30, createdAt: "2026-03-15T09:00:00Z", createdBy: "Sara Tesfaye" },
  { id: "5", title: "System Maintenance", message: "The system will undergo scheduled maintenance on March 25th from 2-4 PM.", type: "alert", recipientGroup: "all_users", status: "scheduled", sentDate: "2026-03-25", readCount: 0, totalRecipients: 150, createdAt: "2026-03-14T11:45:00Z", createdBy: "Yohannes Alemu" },
  { id: "6", title: "Match Results Updated", message: "The results for all weekend matches have been updated in the system.", type: "info", recipientGroup: "all_users", status: "sent", sentDate: "2026-03-16", readCount: 89, totalRecipients: 150, createdAt: "2026-03-16T18:30:00Z", createdBy: "Hana Bekele" },
];

const emptyForm = { title: "", message: "", type: "announcement", recipientGroup: "all_clubs" };

const notificationTypes = [
  { value: "announcement", label: "Announcement" },
  { value: "alert", label: "Alert" },
  { value: "reminder", label: "Reminder" },
  { value: "assignment", label: "Assignment" },
  { value: "info", label: "Information" },
];

const recipientGroups = [
  { value: "all_users", label: "All Users" },
  { value: "all_clubs", label: "All Clubs" },
  { value: "clubs", label: "Specific Clubs" },
  { value: "referees", label: "Referees" },
  { value: "coaches", label: "Coaches" },
  { value: "players", label: "Players" },
];

export default function NotificationsPage() {
  const { data, isLoading } = useSWR("/api/notifications", authFetcher, {
    fallbackData: mockNotifications,
    onError: () => {},
  });

  const notifications: Notification[] = data || mockNotifications;

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "unread" | "read">("all");
  const [sendOpen, setSendOpen] = useState(false);
  const [sendForm, setSendForm] = useState({ title: "", body: "", recipients: "" });

  const filtered = useMemo(() => {
    return notifications.filter((n) => {
      const matchesSearch =
        n.title.toLowerCase().includes(search.toLowerCase()) ||
        n.body.toLowerCase().includes(search.toLowerCase());
      const matchesFilter =
        filter === "all" ||
        (filter === "unread" && !n.read) ||
        (filter === "read" && n.read);
      return matchesSearch && matchesFilter;
    });
  }, [notifications, search, filter]);

  const stats = useMemo(() => {
    const unread = notifications.filter((n) => !n.read).length;
    const read = notifications.filter((n) => n.read).length;
    return { total: notifications.length, unread, read };
  }, [notifications]);

  const handleMarkAllRead = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const handleSend = async () => {
    await new Promise((r) => setTimeout(r, 500));
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

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notifications" description="View system notifications and send alerts to users.">
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleMarkAllRead}>
            <CheckCheck className="h-4 w-4" />
            Mark All Read
          </Button>
          <Button onClick={() => setSendOpen(true)}>
            <Send className="h-4 w-4" />
            Send Notification
          </Button>
        </div>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard title="Total Notifications" value={stats.total} icon={Bell} />
        <StatCard title="Unread" value={stats.unread} icon={Mail} description="Awaiting your attention" />
        <StatCard title="Read" value={stats.read} icon={MailOpen} description="Already reviewed" />
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
        <Select value={filter} onValueChange={(v) => setFilter(v as "all" | "unread" | "read")}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Filter" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="unread">Unread</SelectItem>
            <SelectItem value="read">Read</SelectItem>
          </SelectContent>
        </Select>
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
                  "border-border transition-colors",
                  notification.read ? "bg-card" : "bg-card/80 border-primary/20"
                )}
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

      {/* Send Notification Dialog */}
      <FormDialog
        open={sendOpen}
        onOpenChange={setSendOpen}
        title="Send Notification"
        description="Send a notification to one or more users."
        submitLabel="Send"
        onSubmit={handleSend}
      >
        <div className="flex flex-col gap-4">
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editingNotif, setEditingNotif] = useState<Notification | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Notification | null>(null);
  const [form, setForm] = useState(emptyForm);

  const filtered = useMemo(() => {
    return notifications.filter((notif) => {
      const matchesSearch =
        notif.title.toLowerCase().includes(search.toLowerCase()) ||
        notif.message.toLowerCase().includes(search.toLowerCase()) ||
        notif.createdBy.toLowerCase().includes(search.toLowerCase());
      const matchesType = typeFilter === "all" || notif.type === typeFilter;
      const matchesStatus = statusFilter === "all" || notif.status === statusFilter;
      return matchesSearch && matchesType && matchesStatus;
    });
  }, [notifications, search, typeFilter, statusFilter]);

  const stats = useMemo(() => {
    const sent = notifications.filter((n) => n.status === "sent").length;
    const draft = notifications.filter((n) => n.status === "draft").length;
    const scheduled = notifications.filter((n) => n.status === "scheduled").length;
    return { total: notifications.length, sent, draft, scheduled };
  }, [notifications]);

  const openCreate = () => {
    setEditingNotif(null);
    setForm(emptyForm);
    setFormOpen(true);
  };

  const openEdit = (notif: Notification) => {
    setEditingNotif(notif);
    setForm({
      title: notif.title,
      message: notif.message,
      type: notif.type,
      recipientGroup: notif.recipientGroup,
    });
    setFormOpen(true);
  };

  const handleSubmit = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const handleDelete = async () => {
    await new Promise((r) => setTimeout(r, 500));
  };

  const getReadPercentage = (notif: Notification) => {
    if (notif.totalRecipients === 0) return 0;
    return Math.round((notif.readCount / notif.totalRecipients) * 100);
  };

  const columns: Column<Notification>[] = [
    {
      key: "title",
      header: "Notification",
      render: (notif) => (
        <div className="flex flex-col">
          <span className="text-sm font-medium text-foreground">{notif.title}</span>
          <span className="text-xs text-muted-foreground line-clamp-1">{notif.message}</span>
        </div>
      ),
    },
    {
      key: "type",
      header: "Type",
      className: "hidden md:table-cell",
      render: (notif) => (
        <div className="flex flex-col gap-1">
          <span className="text-sm text-foreground capitalize">{notif.type}</span>
          <span className="text-xs text-muted-foreground">{notif.createdBy}</span>
        </div>
      ),
    },
    {
      key: "engagement",
      header: "Engagement",
      className: "hidden lg:table-cell",
      render: (notif) =>
        notif.status === "sent" ? (
          <div className="flex flex-col gap-1">
            <span className="text-sm text-foreground">
              {notif.readCount}/{notif.totalRecipients}
            </span>
            <span className="text-xs text-muted-foreground">
              {getReadPercentage(notif)}% read
            </span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">-</span>
        ),
    },
    {
      key: "recipients",
      header: "Recipients",
      className: "hidden xl:table-cell",
      render: (notif) => (
        <span className="text-sm text-muted-foreground capitalize">
          {notif.recipientGroup.replace(/_/g, " ")}
        </span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (notif) => <StatusBadge status={notif.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-12",
      render: (notif) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground">
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={() => openEdit(notif)}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </DropdownMenuItem>
            {notif.status === "draft" && (
              <DropdownMenuItem className="text-emerald-400 focus:text-emerald-400">
                <Check className="mr-2 h-4 w-4" />
                Send Now
              </DropdownMenuItem>
            )}
            {notif.status === "sent" && (
              <DropdownMenuItem className="text-blue-400 focus:text-blue-400">
                <Check className="mr-2 h-4 w-4" />
                View Analytics
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => setDeleteTarget(notif)}
              className="text-destructive focus:text-destructive"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Notifications" description="Create and manage system notifications to communicate with users.">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" />
          New Notification
        </Button>
      </PageHeader>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard title="Total Notifications" value={stats.total} icon={Bell} />
        <StatCard title="Sent" value={stats.sent} icon={Bell} description="Delivered to users" />
        <StatCard title="Draft" value={stats.draft} icon={Bell} description="Unsent" />
        <StatCard title="Scheduled" value={stats.scheduled} icon={Bell} description="Pending" />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered}
        isLoading={isLoading}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search notifications..."
        emptyMessage="No notifications found."
        filterSlot={
          <div className="flex items-center gap-2">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {notificationTypes.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="sent">Sent</SelectItem>
                <SelectItem value="scheduled">Scheduled</SelectItem>
              </SelectContent>
            </Select>
          </div>
        }
      />

      {/* Create / Edit Dialog */}
      <FormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        title={editingNotif ? "Edit Notification" : "Create Notification"}
        description={editingNotif ? "Update notification details." : "Send a new notification to users."}
        submitLabel={editingNotif ? "Update" : "Send"}
        onSubmit={handleSubmit}
      >
        <div className="grid gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="notif-title">Title</Label>
            <Input
              id="notif-title"
              value={sendForm.title}
              onChange={(e) => setSendForm({ ...sendForm, title: e.target.value })}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Notification title"
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notif-body">Message</Label>
            <Textarea
              id="notif-body"
              value={sendForm.body}
              onChange={(e) => setSendForm({ ...sendForm, body: e.target.value })}
              placeholder="Write your notification message..."
              rows={4}
            />
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="notif-recipients">Recipients</Label>
            <Input
              id="notif-recipients"
              value={sendForm.recipients}
              onChange={(e) => setSendForm({ ...sendForm, recipients: e.target.value })}
              placeholder="User IDs (comma-separated) or 'all'"
            />
            <p className="text-xs text-muted-foreground">
              {"Enter user IDs separated by commas, or type 'all' for all users."}
            </p>
          </div>
        </div>
      </FormDialog>
            <Label htmlFor="notif-message">Message</Label>
            <Textarea
              id="notif-message"
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
              placeholder="Notification message content"
              rows={4}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="notif-type">Type</Label>
              <Select value={form.type} onValueChange={(val) => setForm({ ...form, type: val })}>
                <SelectTrigger id="notif-type">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {notificationTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="notif-recipients">Recipients</Label>
              <Select
                value={form.recipientGroup}
                onValueChange={(val) => setForm({ ...form, recipientGroup: val })}
              >
                <SelectTrigger id="notif-recipients">
                  <SelectValue placeholder="Select recipients" />
                </SelectTrigger>
                <SelectContent>
                  {recipientGroups.map((group) => (
                    <SelectItem key={group.value} value={group.value}>
                      {group.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </FormDialog>

      {/* Delete Confirmation */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete Notification"
        description={`Are you sure you want to delete "${deleteTarget?.title}"? This action cannot be undone.`}
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}
