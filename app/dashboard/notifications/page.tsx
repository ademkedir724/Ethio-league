"use client";

import { useState, useMemo } from "react";
import useSWR from "swr";
import { authFetcher } from "@/lib/fetch-client";
import { PageHeader } from "@/components/dashboard/page-header";
import { DataTable, type Column } from "@/components/dashboard/data-table";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { FormDialog } from "@/components/dashboard/form-dialog";
import { ConfirmDialog } from "@/components/dashboard/confirm-dialog";
import { StatCard } from "@/components/dashboard/stat-card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="Notification title"
            />
          </div>
          <div className="flex flex-col gap-2">
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
