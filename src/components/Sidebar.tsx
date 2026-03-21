"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  BarChart3,
  Calculator,
  FileText,
  LogOut,
  Menu,
  Package,
  Tags,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/context/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: Calculator },
  { href: "/reports", label: "Báo cáo", icon: FileText },
  { href: "/cash-flow", label: "Dòng tiền", icon: BarChart3 },
  { href: "/product", label: "Sản phẩm", icon: Package },
  { href: "/categories", label: "Danh mục", icon: Tags },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { logout, role, loading } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  if (loading || role === "user" || role === "server") {
    return null;
  }

  return (
    <>
      <button
        className="fixed left-4 top-4 z-50 rounded-lg border border-slate-200 bg-white p-2 shadow-sm lg:hidden"
        onClick={() => setIsOpen((value) => !value)}
      >
        {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>

      <div
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex h-screen w-64 flex-col border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0",
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center border-b border-slate-100 px-6">
          <div className="flex items-center gap-2 text-xl font-bold text-primary">
            <div className="rounded-lg bg-primary/10 p-1.5">
              <Calculator className="h-6 w-6" />
            </div>
            <span>Cost Ong Quan</span>
          </div>
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href;

            return (
              <Link key={item.href} href={item.href}>
                <button
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary shadow-sm"
                      : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                  )}
                >
                  <item.icon
                    className={cn(
                      "h-5 w-5",
                      isActive ? "text-primary" : "text-slate-400"
                    )}
                  />
                  {item.label}
                </button>
              </Link>
            );
          })}
        </div>

        <div className="border-t border-slate-100 p-4">
          <Button
            variant="ghost"
            onClick={logout}
            className="flex w-full items-center justify-start gap-3 px-3 text-rose-600 hover:bg-rose-50 hover:text-rose-700"
          >
            <LogOut className="h-5 w-5" />
            Đăng xuất
          </Button>
        </div>
      </div>

      {isOpen ? (
        <div
          className="fixed inset-0 z-30 bg-slate-900/20 backdrop-blur-sm lg:hidden"
          onClick={() => setIsOpen(false)}
        />
      ) : null}
    </>
  );
}


