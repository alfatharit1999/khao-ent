"use client";

import { ReactNode, useEffect, useState } from "react";
import { getPin, setPin } from "@/lib/adminClient";

/**
 * Renders `children` only after a valid admin PIN is present in this session.
 * Otherwise shows a PIN prompt that verifies against /api/admin/verify.
 */
export function AdminGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [checked, setChecked] = useState(false);
  const [pin, setPinInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    setReady(Boolean(getPin()));
    setChecked(true);
  }, []);

  const submit = async () => {
    setBusy(true);
    setErr(null);
    try {
      const res = await fetch("/api/admin/verify", {
        method: "POST",
        headers: { "x-admin-pin": pin },
      });
      if (!res.ok) throw new Error();
      setPin(pin);
      setReady(true);
    } catch {
      setErr("รหัสไม่ถูกต้อง");
    } finally {
      setBusy(false);
    }
  };

  if (!checked) return null;
  if (ready) return <>{children}</>;

  return (
    <div className="p-4">
      <div className="rounded-2xl border border-border bg-surface p-5">
        <h2 className="text-base font-semibold">โหมดแอดมิน</h2>
        <p className="mt-1 mb-4 text-xs text-muted">
          ใส่รหัสแอดมินเพื่อจัดการเครดิต เติมเงิน และกองกลาง
        </p>
        <input
          type="password"
          inputMode="numeric"
          value={pin}
          onChange={(e) => setPinInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="รหัสแอดมิน"
          className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
        />
        {err ? <p className="mb-2 text-xs text-debt">{err}</p> : null}
        <button
          onClick={submit}
          disabled={busy || !pin}
          className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
        >
          เข้าสู่ระบบ
        </button>
      </div>
    </div>
  );
}
