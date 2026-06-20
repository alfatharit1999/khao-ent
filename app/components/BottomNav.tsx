"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { getPin } from "@/lib/adminClient";

const NAV = {
  home: { href: "/", label: "สั่งข้าว", icon: "🍚" },
  summary: { href: "/summary", label: "เครดิต", icon: "💰" },
  orderList: { href: "/order-list", label: "รวมออเดอร์", icon: "📋" },
  claim: { href: "/claim", label: "เคลม", icon: "🧾" },
  fund: { href: "/fund", label: "กองกลาง", icon: "🏦" },
  admin: { href: "/admin", label: "แอดมิน", icon: "⚙️" },
};

export function BottomNav() {
  const pathname = usePathname();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    setIsAdmin(Boolean(getPin()));
  }, [pathname]); // re-check whenever the user navigates (e.g. after logging in on /admin)

  const items = isAdmin
    ? [NAV.home, NAV.summary, NAV.orderList, NAV.claim, NAV.fund, NAV.admin]
    : [NAV.home, NAV.summary, NAV.orderList, NAV.claim, NAV.admin];

  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className={isAdmin ? "grid grid-cols-6" : "grid grid-cols-5"}>
        {items.map((it) => {
          const active =
            it.href === "/" ? pathname === "/" : pathname.startsWith(it.href);
          return (
            <li key={it.href}>
              <Link
                href={it.href}
                className="flex flex-col items-center gap-0.5 py-2.5 text-[11px]"
                style={{ color: active ? "var(--brand)" : "var(--muted)" }}
              >
                <span className="text-lg leading-none">{it.icon}</span>
                <span className={active ? "font-semibold" : ""}>{it.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
