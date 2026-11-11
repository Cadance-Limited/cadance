"use client";

import * as React from "react";
import { onWaitlistUpdated } from "@/lib/prompt-bus";

/**
 * Fetches the live waitlist count from /api/subscribe (GET) and subscribes
 * to client-side waitlist updates so new signups increment the count immediately.
 */
export function useWaitlistCount(base = 412) {
  const [count, setCount] = React.useState<number | null>(null);

  const fetchCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/subscribe", { method: "GET", cache: "no-store" });
      const data = await res.json();
      if (data?.ok && typeof data.count === "number") {
        setCount(Math.max(data.count, base));
      }
    } catch {
      /* keep fallback base */
    }
  }, [base]);

  React.useEffect(() => {
    fetchCount();
    return onWaitlistUpdated(() => {
      fetchCount();
    });
  }, [fetchCount]);

  return count ?? base;
}
