"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "สั่งข้าว", icon: "🍚" },
  { href: "/summary", label: "เครดิต", icon: "💰" },
  { href: "/order-list", label: "รวมออเดอร์", icon: "📋" },
  { href: "/fund", label: "กองกลาง", icon: "🏦" },
  { href: "/admin", label: "แอดมิน", icon: "⚙️" },
];

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border bg-surface"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-5">
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
