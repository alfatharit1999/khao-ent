"use client";

import { useEffect, useState } from "react";
import type { Person, TopupRequest } from "@/lib/types";
import {
  createTopupRequest,
  getMyTopupRequests,
  requestSettlement,
} from "@/lib/queries";
import { baht, todayISO } from "@/lib/format";

const BANK_ACCOUNT = "2093057435";
const BANK_NAME = "ธนาคาร KKP (เกียรตินาคินภัทร)";
const ACCOUNT_NAME = "ธฤต ปิยะวรรณรัตน์";
const LINE_ID = "alfatharit";

const STATUS_LABEL: Record<TopupRequest["status"], string> = {
  pending: "รอตรวจสอบ",
  approved: "อนุมัติแล้ว ✓",
  rejected: "ไม่อนุมัติ",
};
const STATUS_COLOR: Record<TopupRequest["status"], string> = {
  pending: "var(--muted)",
  approved: "var(--credit)",
  rejected: "var(--debt)",
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="ml-2 rounded-lg border border-border px-2 py-0.5 text-[11px] font-medium"
      style={{ color: copied ? "var(--credit)" : "var(--brand)" }}
    >
      {copied ? "คัดลอกแล้ว ✓" : "คัดลอก"}
    </button>
  );
}

export function TopupPanel({
  me,
  myBalance,
  onDone,
}: {
  me: Person;
  myBalance: number;
  onDone: () => void;
}) {
  const [mode, setMode] = useState<"idle" | "topup" | "withdraw">("idle");
  const [topupAmount, setTopupAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawDone, setWithdrawDone] = useState<{
    amount: number;
    newBalance: number;
  } | null>(null);
  const [topupDone, setTopupDone] = useState(false);
  const [myRequests, setMyRequests] = useState<TopupRequest[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const loadRequests = async () => {
    try {
      setMyRequests(await getMyTopupRequests(me.id));
    } catch { /* ignore */ }
  };

  useEffect(() => { loadRequests(); }, [me.id]);

  const submitTopup = async () => {
    const amt = Number(topupAmount);
    if (!amt || amt <= 0) return setErr("ใส่จำนวนเงินที่ต้องการเติม");
    setBusy(true);
    setErr(null);
    try {
      await createTopupRequest(me.id, amt);
      setTopupDone(true);
      setTopupAmount("");
      await loadRequests();
    } catch {
      setErr("ส่งคำขอไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const submitWithdraw = async () => {
    const amt = Number(withdrawAmount);
    if (!amt || amt <= 0) return setErr("ใส่จำนวนเงินที่ต้องการถอน");
    if (amt > myBalance) return setErr("จำนวนเกินเครดิตที่มี");
    setBusy(true);
    setErr(null);
    try {
      await requestSettlement(me.id, amt, todayISO());
      setWithdrawDone({ amount: amt, newBalance: myBalance - amt });
      setWithdrawAmount("");
      onDone();
    } catch {
      setErr("บันทึกไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setMode("idle");
    setTopupDone(false);
    setWithdrawDone(null);
    setErr(null);
  };

  return (
    <div className="space-y-2">
      {/* Action buttons */}
      {mode === "idle" && (
        <div className="flex gap-2">
          <button
            onClick={() => setMode("topup")}
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            style={{ color: "var(--credit)" }}
          >
            💳 เติมเครดิต
          </button>
          <button
            onClick={() => { setMode("withdraw"); setErr(null); }}
            className="flex-1 rounded-xl border border-border bg-surface px-3 py-2.5 text-sm font-medium"
            style={{ color: "var(--debt)" }}
          >
            💸 ขอเงินคืน
          </button>
        </div>
      )}

      {/* ── Top-up panel ── */}
      {mode === "topup" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">💳 เติมเครดิต</h3>
            <button onClick={reset} className="text-xs text-muted">ปิด</button>
          </div>

          {!topupDone ? (
            <>
              {/* Bank details */}
              <div className="mb-3 rounded-xl border border-border bg-background p-3 space-y-1.5">
                <p className="text-xs text-muted">{BANK_NAME}</p>
                <p className="text-xs text-muted">ชื่อบัญชี: <span className="font-medium text-text">{ACCOUNT_NAME}</span></p>
                <div className="flex items-center">
                  <p className="text-xs text-muted">เลขบัญชี:</p>
                  <span className="ml-1.5 text-sm font-bold tracking-widest">{BANK_ACCOUNT}</span>
                  <CopyButton text={BANK_ACCOUNT} />
                </div>
              </div>

              <label className="mb-1 block text-xs text-muted">จำนวนที่ต้องการเติม (บาท)</label>
              <input
                value={topupAmount}
                onChange={(e) => setTopupAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                className="mb-3 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              {err ? <p className="mb-2 text-xs text-debt">{err}</p> : null}
              <button
                onClick={submitTopup}
                disabled={busy || !topupAmount}
                className="w-full rounded-xl bg-brand px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              >
                ส่งคำขอเติมเครดิต
              </button>
              <p className="mt-2 text-[11px] text-muted text-center">
                โอนเงินก่อน แล้วส่ง slip ที่ LINE: <span className="font-semibold text-brand">{LINE_ID}</span>
              </p>
            </>
          ) : (
            <div className="space-y-3 text-center">
              <p className="text-2xl">✅</p>
              <p className="text-sm font-semibold">ส่งคำขอแล้ว!</p>
              <p className="text-xs text-muted">
                โอนเงิน <span className="font-semibold">{baht(Number(topupAmount) || 0)}</span> มาที่บัญชี KKP ด้านบน
                แล้วส่ง slip ที่ LINE:{" "}
                <span className="font-bold text-brand">{LINE_ID}</span>
              </p>
              <p className="text-xs text-muted">เครดิตจะเพิ่มหลังแอดมินตรวจสอบ</p>
              <button onClick={reset} className="text-xs text-brand underline">ปิด</button>
            </div>
          )}
        </div>
      )}

      {/* ── Withdraw panel ── */}
      {mode === "withdraw" && (
        <div className="rounded-2xl border border-border bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">💸 ขอเงินคืน</h3>
            <button onClick={reset} className="text-xs text-muted">ปิด</button>
          </div>

          {!withdrawDone ? (
            <>
              <div className="mb-3 rounded-xl bg-background px-3 py-2.5">
                <p className="text-xs text-muted">เครดิตคงเหลือ</p>
                <p className="text-xl font-bold" style={{ color: myBalance > 0 ? "var(--credit)" : "var(--debt)" }}>
                  {baht(myBalance)}
                </p>
              </div>
              <label className="mb-1 block text-xs text-muted">จำนวนที่ต้องการถอน (บาท)</label>
              <input
                value={withdrawAmount}
                onChange={(e) => setWithdrawAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                inputMode="decimal"
                placeholder="0"
                className="mb-2 w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-brand"
              />
              <p className="mb-3 text-[11px] text-debt">⚠️ เครดิตจะถูกหักทันที</p>
              {err ? <p className="mb-2 text-xs text-debt">{err}</p> : null}
              <button
                onClick={submitWithdraw}
                disabled={busy || !withdrawAmount || myBalance <= 0}
                className="w-full rounded-xl px-3 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                style={{ background: "var(--debt)" }}
              >
                ยืนยันขอเงินคืน
              </button>
            </>
          ) : (
            /* Confirmation screen — user should screenshot this */
            <div className="space-y-3 rounded-xl border-2 border-dashed border-brand p-4">
              <p className="text-center text-base font-bold">📸 Screenshot หน้านี้</p>
              <div className="space-y-1 rounded-xl bg-background p-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted">ชื่อ</span>
                  <span className="font-semibold">{me.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">ยอดขอถอน</span>
                  <span className="font-semibold text-debt">{baht(withdrawDone.amount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">เครดิตคงเหลือ</span>
                  <span className="font-semibold" style={{ color: withdrawDone.newBalance >= 0 ? "var(--credit)" : "var(--debt)" }}>
                    {baht(withdrawDone.newBalance)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted">วันที่</span>
                  <span>{todayISO()}</span>
                </div>
              </div>
              <p className="text-center text-xs text-muted">
                ส่ง screenshot นี้ที่ LINE:{" "}
                <span className="font-bold text-brand">{LINE_ID}</span>
              </p>
              <p className="text-center text-[11px] text-muted">แอดมินจะโอนเงินให้หลังได้รับ</p>
              <button onClick={reset} className="w-full text-center text-xs text-muted underline pt-1">
                ปิด
              </button>
            </div>
          )}
        </div>
      )}

      {/* Recent top-up requests status */}
      {myRequests.length > 0 && mode === "idle" && (
        <div className="rounded-2xl border border-border bg-surface">
          <div className="border-b border-border px-4 py-2 text-xs font-semibold text-muted">
            คำขอเติมเครดิตล่าสุด
          </div>
          <ul className="divide-y divide-border">
            {myRequests.map((r) => (
              <li key={r.id} className="flex items-center justify-between px-4 py-2 text-xs">
                <span>{baht(Number(r.amount))}</span>
                <span
                  className="font-medium"
                  style={{ color: STATUS_COLOR[r.status] }}
                >
                  {STATUS_LABEL[r.status]}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
