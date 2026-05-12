"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard, ShoppingCart, Factory, Users, Package,
  CheckCircle, QrCode, BarChart3, Scissors, Building2, LogOut,
  ScrollText, Truck, Printer, Gift, Menu, X, ChevronDown,
  UserCircle, Wallet, DollarSign, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth/auth-context";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";

interface NavItem {
  title: string;
  icon: any;
  href: string;
  perm?: string;
  group?: string;
}

const NAV: NavItem[] = [
  { title: "Dashboard",         icon: LayoutDashboard, href: "/",            group: "Asosiy" },
  { title: "Klientlar",         icon: Building2,       href: "/clients",     perm: "clients.read",    group: "Asosiy" },
  { title: "Zakazlar",          icon: ShoppingCart,    href: "/orders",      perm: "orders.read",     group: "Asosiy" },

  { title: "Production Scan",   icon: QrCode,          href: "/production-scan",  perm: "production.qr.scan",   group: "Production" },
  { title: "QR Codes",          icon: QrCode,          href: "/qr-codes",         perm: "production.qr.create", group: "Production" },
  { title: "Traceability",      icon: ScrollText,      href: "/trace",            perm: "production.trace.view",group: "Production" },
  { title: "Production",        icon: Factory,         href: "/production",       perm: "production.read",      group: "Production" },
  { title: "Quality",           icon: CheckCircle,     href: "/quality",          perm: "quality.read",         group: "Production" },
  { title: "Worker Scan",       icon: QrCode,          href: "/scanning",         perm: "qr.scan",              group: "Production" },
  { title: "Print",             icon: Printer,         href: "/print",            perm: "print.read",           group: "Production" },

  { title: "Ombor",             icon: Package,         href: "/inventory",   perm: "inventory.read",  group: "Ombor" },
  { title: "Izlishka",          icon: Gift,            href: "/surplus",     perm: "surplus.read",    group: "Ombor" },
  { title: "BoxApp",            icon: Package,         href: "/boxes",       perm: "box.read",        group: "Ombor" },
  { title: "BoxApp Sync",       icon: RefreshCw,       href: "/boxapp-sync", perm: "boxapp.view",     group: "Ombor" },
  { title: "Shipmentlar",       icon: Truck,           href: "/shipments",   perm: "box.read",        group: "Ombor" },

  { title: "Ishchilar",         icon: Users,           href: "/workers",       perm: "workers.read",       group: "Tashkilot" },
  { title: "Mening Profilim",   icon: UserCircle,      href: "/my-profile",                                group: "Tashkilot" },
  { title: "Payroll",           icon: Wallet,          href: "/payroll",       perm: "payroll.view_all",   group: "Tashkilot" },
  { title: "Mening Oyligim",    icon: Wallet,          href: "/my-payroll",    perm: "payroll.view_own",   group: "Tashkilot" },
  { title: "Piece Rates",       icon: DollarSign,      href: "/piece-rates",   perm: "piece_rates.read",   group: "Tashkilot" },
  { title: "Foydalanuvchilar",  icon: Users,           href: "/users",         perm: "users.read",         group: "Tashkilot" },
  { title: "Hisobotlar",        icon: BarChart3,       href: "/reports",       perm: "reports.read",       group: "Tashkilot" },
  { title: "Audit",             icon: ScrollText,      href: "/audit",         perm: "audit.read",         group: "Tashkilot" },
];

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, hasPermission } = useAuth();

  // Owner role gets ALL permissions, but to be defensive: also show items without perm OR if user has perm OR if user is owner.
  const isOwner = user?.role_id === 'owner';
  const visible = NAV.filter(i => !i.perm || isOwner || hasPermission(i.perm));

  // Group items
  const groups: Record<string, NavItem[]> = {};
  for (const item of visible) {
    const g = item.group || 'Boshqa';
    if (!groups[g]) groups[g] = [];
    groups[g].push(item);
  }

  const initials = user?.full_name
    ? user.full_name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "??";

  return (
    <>
      {/* Mobile backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/50 lg:hidden transition-opacity",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
      />

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-0 left-0 z-50 h-screen w-64 bg-sidebar border-r border-sidebar-border flex flex-col",
          "transition-transform duration-200 ease-in-out",
          "lg:translate-x-0 lg:static lg:z-auto",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Header */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4 shrink-0">
          <Link href="/" className="flex items-center gap-2" onClick={onClose}>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Scissors className="h-4 w-4" />
            </div>
            <div className="flex flex-col leading-tight">
              <span className="font-semibold text-sm text-sidebar-foreground">BILLUR ERP</span>
              <span className="text-[10px] text-muted-foreground">Production System</span>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="lg:hidden" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-2 py-3">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group} className="mb-3">
              <div className="px-2 py-1 text-[10px] font-semibold uppercase text-muted-foreground tracking-wide">
                {group}
              </div>
              <ul className="space-y-0.5">
                {items.map(item => {
                  const isActive = pathname === item.href ||
                    (item.href !== "/" && pathname.startsWith(item.href));
                  const Icon = item.icon;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={onClose}
                        className={cn(
                          "flex items-center gap-2 rounded-md px-2 py-1.5 text-sm transition-colors",
                          isActive
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                        )}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="truncate">{item.title}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User dropdown */}
        <div className="border-t border-sidebar-border p-2 shrink-0">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="w-full flex items-center gap-2 rounded-md p-2 hover:bg-sidebar-accent/50 transition-colors">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="text-xs bg-primary text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 text-left text-xs">
                  <div className="font-semibold text-sidebar-foreground truncate">
                    {user?.full_name || "—"}
                  </div>
                  <div className="text-muted-foreground uppercase text-[10px]">
                    {user?.role_id || ""}
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs">
                <div className="font-medium">{user?.username}</div>
                <div className="text-muted-foreground font-normal text-[11px]">
                  {user?.permissions?.length || 0} ta huquq
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => { await logout(); router.push("/login"); }}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Chiqish</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    </>
  );
}

// Top header (always visible) — has hamburger for mobile
export function TopHeader({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b bg-background px-4">
      <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuClick}>
        <Menu className="h-5 w-5" />
      </Button>
      <div className="font-semibold">BILLUR ERP</div>
    </header>
  );
}
