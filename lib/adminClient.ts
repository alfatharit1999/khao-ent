"use client";

const KEY = "ent-lunch-admin-pin";

export function getPin(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem(KEY);
}

export function setPin(pin: string | null) {
  if (typeof window === "undefined") return;
  if (pin) sessionStorage.setItem(KEY, pin);
  else sessionStorage.removeItem(KEY);
}

/** POST to an admin API route with the stored PIN. Throws on failure. */
export async function adminFetch<T = unknown>(
  path: string,
  body: unknown,
): Promise<T> {
  const pin = getPin();
  const res = await fetch(path, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-admin-pin": pin ? encodeURIComponent(pin) : "",
    },
    body: JSON.stringify(body),
  });
  if (res.status === 401) {
    setPin(null);
    throw new Error("รหัสแอดมินไม่ถูกต้อง");
  }
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "ทำรายการไม่สำเร็จ");
  return json as T;
}
