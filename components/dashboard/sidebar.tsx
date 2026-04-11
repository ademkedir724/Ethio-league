"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/lib/use-permissions";
import { useAuth } from "@/lib/auth-context";
import { authFetcher } from "@/lib/fetch-client";
import useSWR from "swr";
import {
  LayoutDashboard,
  Building2,
  Users,
  Shield,
  UserCircle,
  Megaphone,
  Swords,
  Bell,
  Trophy,
  ChevronLeft,
  ChevronRight,
  Layers,
  BarChart3,
  ClipboardList,
  FileText,
  Settings,
  ClipboardCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

const allNavItems = [
  {
    title: "Overview",
    href: "/dashboard",
    icon: LayoutDashboard,
    key: "overview",
  },
  {
    title: "Organizations",
    href: "/dashboard/organizations",
    icon: Building2,
    key: "organizations",
  },
  {
    title: "Users",
    href: "/dashboard/users",
    icon: Users,
    key: "users",
  },
  {
    title: "Leagues",
    href: "/dashboard/leagues",
    icon: Layers,
    key: "leagues",
  },
  {
    title: "Clubs",
    href: "/dashboard/clubs",
    icon: Shield,
    key: "clubs",
  },
  {
    title: "Players",
    href: "/dashboard/players",
    icon: UserCircle,
    key: "players",
  },
  {
    title: "Coaches",
    href: "/dashboard/coaches",
    icon: Trophy,
    key: "coaches",
  },
  {
    title: "Referees",
    href: "/dashboard/referees",
    icon: Megaphone,
    key: "referees",
  },
  {
    title: "Matches",
    href: "/dashboard/matches",
    icon: Swords,
    key: "matches",
  },
  {
    title: "Notifications",
    href: "/dashboard/notifications",
    icon: Bell,
    key: "notifications",
  },
];

interface DashboardSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

export function DashboardSidebar({
  collapsed,
  onToggle,
}: DashboardSidebarProps) {
  const pathname = usePathname();
  const { canViewNavItem } = usePermissions();
  const { isSuperAdmin, isLeagueAdmin, isClubAdmin, isOrgAdmin, isMEA, user, getLeagueId, getClubId } = useAuth();

  const leagueId = isLeagueAdmin() ? getLeagueId() : null;
  const clubId = isClubAdmin() ? getClubId() : null;
  const { data: leagueData } = useSWR(
    leagueId ? `/api/leagues/${leagueId}` : null,
    authFetcher
  );
  const leagueName: string | undefined = leagueData?.name;

  // Filter nav items based on user permissions
  const navItems = allNavItems.filter((item) => canViewNavItem(item.href));

  // Role-specific nav items
  const roleNavItems = [
    ...(isOrgAdmin()
      ? [
        { title: "Standings", href: "/dashboard/standings", icon: BarChart3 },
        { title: "Assignments", href: "/dashboard/seasons/assignments", icon: ClipboardCheck },
      ]
      : []),
    ...(isLeagueAdmin()
      ? [
        { title: "Standings", href: "/dashboard/standings", icon: BarChart3 },
        { title: "Squad Management", href: "/dashboard/squad-management", icon: ClipboardCheck },
      ]
      : []),
    ...(isClubAdmin()
      ? [
        ...(clubId ? [{ title: "My Club", href: `/dashboard/clubs/${clubId}`, icon: Shield }] : []),
        { title: "Standings", href: "/dashboard/standings", icon: BarChart3 },
        { title: "Lineups", href: "/dashboard/lineups", icon: ClipboardList },
        { title: "Squad Request", href: "/dashboard/squad-request", icon: Users },
      ]
      : []),
    ...(isMEA() && !isLeagueAdmin() && !isOrgAdmin() && !isClubAdmin()
      ? [
        { title: "Standings", href: "/dashboard/standings", icon: BarChart3 },
      ]
      : []),
    ...(isSuperAdmin()
      ? [
        { title: "Standings", href: "/dashboard/standings", icon: BarChart3 },
        { title: "Audit Log", href: "/dashboard/audit-log", icon: FileText },
        { title: "System Config", href: "/dashboard/system-config", icon: Settings },
      ]
      : []),
  ];

  // Profile is visible to all authenticated users
  const profileNavItem = user
    ? { title: "Profile", href: "/dashboard/profile", icon: UserCircle }
    : null;

  const renderNavLink = (item: { title: string; href: string; icon: React.ElementType }) => {
    const isActive =
      pathname === item.href ||
      (item.href !== "/dashboard" && pathname.startsWith(item.href));

    const linkContent = (
      <Link
        href={item.href}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-primary"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
        )}
      >
        <item.icon
          className={cn(
            "h-4.5 w-4.5 shrink-0",
            isActive && "text-sidebar-primary"
          )}
        />
        {!collapsed && <span>{item.title}</span>}
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip key={item.href}>
          <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
          <TooltipContent
            side="right"
            className="bg-popover text-popover-foreground"
          >
            {item.title}
          </TooltipContent>
        </Tooltip>
      );
    }

    return <div key={item.href}>{linkContent}</div>;
  };

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "fixed left-0 top-0 z-30 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300",
          collapsed ? "w-16" : "w-60"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trophy className="h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0">
              <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
                Ethio-League
              </span>
              {isLeagueAdmin() && leagueName && (
                <span className="text-xs text-sidebar-foreground/60 truncate">
                  {leagueName}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Nav */}
        <ScrollArea className="flex-1 py-3">
          <nav className="flex flex-col gap-1 px-2">
            {navItems.map((item) => renderNavLink(item))}

            {roleNavItems.length > 0 && (
              <>
                <Separator className="my-1 bg-sidebar-border" />
                {roleNavItems.map((item) => renderNavLink(item))}
              </>
            )}

            {profileNavItem && (
              <>
                <Separator className="my-1 bg-sidebar-border" />
                {renderNavLink(profileNavItem)}
              </>
            )}
          </nav>
        </ScrollArea>

        <Separator className="bg-sidebar-border" />

        {/* Collapse toggle */}
        <div className="flex items-center justify-center p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggle}
            className="h-8 w-8 text-sidebar-foreground/60 hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
            <span className="sr-only">
              {collapsed ? "Expand sidebar" : "Collapse sidebar"}
            </span>
          </Button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
