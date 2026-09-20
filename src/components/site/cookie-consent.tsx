"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Cookie } from "lucide-react";

const STORAGE_KEY = "cadence:cookie-consent";

/**
 * Lightweight cookie consent banner. Choice is persisted to
 * localStorage so it only appears once per visitor.
 */
export function CookieConsent() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // tiny delay so it doesn't fight with hero animations on load
        const t = setTimeout(() => setVisible(true), 1200);
        return () => clearTimeout(t);
      }
    } catch {
      /* localStorage may be unavailable */
    }
  }, []);

  function decide(choice: "accepted" | "declined") {
    try {
      localStorage.setItem(STORAGE_KEY, choice);
    } catch {
      /* ignore */
    }
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3 }}
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4"
        >
          <div className="flex w-full max-w-3xl flex-col items-start gap-3 rounded-xl border border-border bg-background/90 p-4 shadow-[0_12px_40px_-12px_oklch(0_0_0/0.5)] backdrop-blur-xl sm:flex-row sm:items-center">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary/60">
              <Cookie className="h-4 w-4 text-muted-foreground" />
            </span>
            <p className="flex-1 text-xs leading-relaxed text-muted-foreground">
              We use cookies to remember your theme and keep the demo fast.
              No tracking, no ad pixels. Read our{" "}
              <Link
                href="#"
                className="font-medium text-foreground underline-offset-2 hover:underline"
              >
                privacy policy
              </Link>
              .
            </p>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={() => decide("declined")}
                className="inline-flex h-8 items-center rounded-lg border border-border bg-secondary/40 px-3 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Decline
              </button>
              <button
                onClick={() => decide("accepted")}
                className="inline-flex h-8 items-center rounded-lg bg-foreground px-3 text-xs font-medium text-background transition-all hover:translate-y-[-1px]"
              >
                Accept
              </button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
