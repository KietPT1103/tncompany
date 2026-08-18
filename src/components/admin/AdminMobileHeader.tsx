"use client";

import Link from "next/link";
import { Plus } from "lucide-react";
import { usePathname } from "next/navigation";

import { getAdminMobileHeaderAction } from "@/components/admin/adminMobileHeaderConfig";

const actionIcons = {
  plus: Plus,
};

export function AdminMobileHeader() {
  const pathname = usePathname();
  const action = getAdminMobileHeaderAction(pathname);
  const ActionIcon = action ? actionIcons[action.icon] : null;

  return (
    <header
      aria-label="Thanh điều hướng quản trị"
      className="fixed inset-x-0 top-0 z-20 flex h-16 items-center justify-center border-b border-[#F6C85F]/20 bg-[linear-gradient(135deg,#064E3B,#033C2F)] px-16 shadow-[0_2px_6px_rgba(0,35,25,0.2)] lg:hidden"
    >
      <Link
        href="/"
        aria-label="Về Tổng quan kinh doanh"
        className="flex h-12 w-[156px] items-center justify-center overflow-hidden rounded-md transition-[opacity,transform] duration-150 ease-out hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E3B] active:scale-[0.96] motion-reduce:transition-none"
      >
        <img
          src="/assets/tn_services.png"
          alt="TN Services"
          className="h-auto w-[140px] max-w-none"
          draggable={false}
        />
      </Link>

      {action && ActionIcon ? (
        <Link
          href={action.href}
          aria-label={action.label}
          title={action.label}
          className="absolute right-4 top-3 inline-flex h-11 w-11 items-center justify-center rounded-md bg-emerald-800 text-[#ffb800] shadow-[0_2px_6px_rgba(0,25,18,0.22)] transition-[background-color,transform] duration-150 ease-out hover:bg-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F6C85F] focus-visible:ring-offset-2 focus-visible:ring-offset-[#064E3B] active:scale-[0.96] motion-reduce:transition-none"
        >
          <ActionIcon className="h-5 w-5" />
        </Link>
      ) : null}
    </header>
  );
}
