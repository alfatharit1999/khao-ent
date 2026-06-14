import { ReactNode } from "react";

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-surface/90 px-4 py-3 backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold leading-tight">{title}</h1>
          {subtitle ? (
            <p className="text-xs text-muted">{subtitle}</p>
          ) : null}
        </div>
        {right}
      </div>
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-border bg-surface ${className}`}
    >
      {children}
    </div>
  );
}

export function SetupHint() {
  return (
    <div className="m-4 rounded-2xl border border-border bg-brand-soft p-4 text-sm">
      <p className="font-semibold">ยังไม่ได้เชื่อมต่อฐานข้อมูล</p>
      <p className="mt-1 text-muted">
        แอปยังไม่ได้ตั้งค่า Supabase — ใส่ค่า{" "}
        <code className="rounded bg-surface px-1">NEXT_PUBLIC_SUPABASE_URL</code>{" "}
        และ{" "}
        <code className="rounded bg-surface px-1">
          NEXT_PUBLIC_SUPABASE_ANON_KEY
        </code>{" "}
        ในไฟล์ <code className="rounded bg-surface px-1">.env.local</code> ก่อน
      </p>
    </div>
  );
}
