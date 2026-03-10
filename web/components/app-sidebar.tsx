"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FlaskConical,
  ListOrdered,
  Settings,
  Plus,
  Bug,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useState, createContext, useContext } from "react";

const SidebarContext = createContext({ open: true, toggle: () => {} });
export function useSidebar() {
  return useContext(SidebarContext);
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/playground", label: "Playground", icon: FlaskConical },
  { href: "/queue", label: "Queue Monitor", icon: ListOrdered },
  { href: "/system", label: "System", icon: Settings },
];

function SidebarNav({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1 px-2">
      {navItems.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        const linkContent = (
          <Link
            href={item.href}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="size-4 shrink-0" />
            {!collapsed && <span>{item.label}</span>}
          </Link>
        );

        if (collapsed) {
          return (
            <Tooltip key={item.href}>
              <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
              <TooltipContent side="right">{item.label}</TooltipContent>
            </Tooltip>
          );
        }

        return <div key={item.href}>{linkContent}</div>;
      })}
    </nav>
  );
}

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const collapsed = isMobile ? false : !open;

  const toggle = () => {
    if (isMobile) setMobileOpen(!mobileOpen);
    else setOpen(!open);
  };

  return (
    <SidebarContext.Provider value={{ open, toggle }}>
      <div className="flex min-h-screen">
        {/* Mobile overlay */}
        {isMobile && mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Sidebar */}
        <aside
          className={cn(
            "fixed top-0 left-0 z-50 flex h-screen flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200",
            isMobile
              ? mobileOpen
                ? "w-64 translate-x-0"
                : "-translate-x-full w-64"
              : collapsed
                ? "w-14"
                : "w-56"
          )}
        >
          {/* Header */}
          <div className={cn("flex items-center h-14 px-3", collapsed ? "justify-center" : "justify-between")}>
            {!collapsed && (
              <Link href="/" className="flex items-center gap-2">
                <Bug className="size-5 text-primary" />
                <span className="font-bold text-lg text-sidebar-foreground">Spider</span>
              </Link>
            )}
            {collapsed && (
              <Link href="/">
                <Bug className="size-5 text-primary" />
              </Link>
            )}
          </div>

          <Separator />

          {/* Nav */}
          <div className="flex-1 py-3 overflow-y-auto">
            <SidebarNav collapsed={collapsed} />
          </div>

          <Separator />

          {/* New Job Button */}
          <div className="p-3">
            {collapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" asChild className="w-full">
                    <Link href="/new">
                      <Plus className="size-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">New Job</TooltipContent>
              </Tooltip>
            ) : (
              <Button asChild className="w-full">
                <Link href="/new">
                  <Plus className="size-4" />
                  New Job
                </Link>
              </Button>
            )}
          </div>
        </aside>

        {/* Main content */}
        <div
          className={cn(
            "flex-1 transition-all duration-200",
            isMobile ? "ml-0" : collapsed ? "ml-14" : "ml-56"
          )}
        >
          {/* Top bar */}
          <header className="sticky top-0 z-30 flex items-center h-14 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4">
            <Button variant="ghost" size="icon" onClick={toggle}>
              <PanelLeft className="size-4" />
            </Button>
          </header>
          <main className="p-6">{children}</main>
        </div>
      </div>
    </SidebarContext.Provider>
  );
}
