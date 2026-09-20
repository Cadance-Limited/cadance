"use client";

import * as React from "react";

/**
 * Fetches the live waitlist count from /api/subscribe (GET).
 * Falls back to a base number if the API is unreachable, so the UI
 * never shows a broken/zero count on first paint.
 */
export function useWaitlistCount(base = 412) {
  const [count, setCount] = React.useState<number | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch("/api/subscribe", { method: "GET" })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && d?.ok && typeof d.count === "number") {
          setCount(Math.max(d.count, base));
        }
      })
      .catch(() => {
        /* keep null — component falls back to base */
      });
    return () => {
      cancelled = true;
    };
  }, [base]);

  return count ?? base;
}
