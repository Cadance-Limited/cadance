"use client";

import * as React from "react";
import { onWaitlistUpdated } from "@/lib/prompt-bus";

/**
 * Fetches the verified waitlist registration count from /api/subscribe (GET).
 * Never invents or inflates counts with a hardcoded baseline; returns null
 * while loading or if the database is unreachable.
 */
export function useWaitlistCount() {
  const [count, setCount] = React.useState<number | null>(null);

  const fetchCount = React.useCallback(async () => {
    try {
      const res = await fetch("/api/subscribe", {
        method: "GET",
        cache: "no-store",
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data?.ok && typeof data.count === "number" && data.count >= 0) {
        setCount(data.count);
      }
    } catch {
      /* leave count as null if unreachable */
    }
  }, []);

  React.useEffect(() => {
    fetchCount();
    return onWaitlistUpdated(() => {
      fetchCount();
    });
  }, [fetchCount]);

  return count;
}
