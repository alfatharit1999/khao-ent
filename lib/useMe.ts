"use client";

import { useEffect, useState } from "react";

const KEY = "ent-lunch-me";

/** Remembers which person is using this device (no passwords). */
export function useMe(): [string | null, (id: string | null) => void] {
  const [me, setMe] = useState<string | null>(null);

  useEffect(() => {
    setMe(localStorage.getItem(KEY));
  }, []);

  const update = (id: string | null) => {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
    setMe(id);
  };

  return [me, update];
}
