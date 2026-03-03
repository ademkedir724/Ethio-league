import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusStyles: Record<string, string> = {
  active: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  approved: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  completed: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  live: "bg-red-500/15 text-red-400 border-red-500/20",
  pending: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  scheduled: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  upcoming: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  inactive: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  rejected: "bg-red-500/15 text-red-400 border-red-500/20",
  suspended: "bg-red-500/15 text-red-400 border-red-500/20",
  cancelled: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
  postponed: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  draft: "bg-zinc-500/15 text-zinc-400 border-zinc-500/20",
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const style = statusStyles[status.toLowerCase()] || statusStyles.inactive;

  return (
    <Badge
      variant="outline"
      className={cn("capitalize", style, className)}
    >
      {status.replace(/_/g, " ")}
    </Badge>
  );
}
