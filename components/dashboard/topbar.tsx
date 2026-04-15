"use client";

import { useAuth } from "@/lib/auth-context";
import { authFetcher } from "@/lib/fetch-client";
import { getRoleLabel } from "@/lib/role-labels";
import { Bell, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import Link from "next/link";
import useSWR from "swr";

export function Topbar() {
  const { user, logout } = useAuth();

  const { data: profile } = useSWR<{ photoUrl?: string | null }>(
    user ? "/api/users/me" : null,
    authFetcher
  );

  const initials = user?.fullName
    ? user.fullName
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)
    : "AD";

  const primaryRole = user?.roles?.[0]?.roleName
    ? getRoleLabel(user.roles[0].roleName)
    : "Admin";

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-medium text-muted-foreground">
          Welcome back,{" "}
          <span className="text-foreground">{user?.fullName || "Admin"}</span>
        </h2>
      </div>

      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="relative text-muted-foreground hover:text-foreground"
          asChild
        >
          <Link href="/dashboard/notifications">
            <Bell className="h-4.5 w-4.5" />
            <span className="sr-only">Notifications</span>
          </Link>
        </Button>

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="flex items-center gap-2 px-2 hover:bg-accent"
            >
              <Avatar className="h-8 w-8">
                {profile?.photoUrl && (
                  <AvatarImage src={profile.photoUrl} alt={user?.fullName ?? "User"} />
                )}
                <AvatarFallback className="bg-primary/15 text-xs text-primary">
                  {initials}
                </AvatarFallback>
              </Avatar>
              <div className="hidden flex-col items-start md:flex">
                <span className="text-sm font-medium text-foreground">
                  {user?.fullName || "Admin"}
                </span>
                <Badge
                  variant="secondary"
                  className="h-4 px-1.5 text-[10px]"
                >
                  {primaryRole}
                </Badge>
              </div>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="w-56 bg-popover text-popover-foreground"
          >
            <DropdownMenuLabel>
              <div className="flex items-center gap-3">
                <Avatar className="h-9 w-9">
                  {profile?.photoUrl && (
                    <AvatarImage src={profile.photoUrl} alt={user?.fullName ?? "User"} />
                  )}
                  <AvatarFallback className="bg-primary/15 text-xs text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm font-medium">{user?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{user?.email}</p>
                </div>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" asChild>
              <Link href="/dashboard/profile">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={logout}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
