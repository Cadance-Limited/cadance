"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, X } from "lucide-react";

const STORAGE_KEY = "cadence:tour-seen";

type Step = {
  target: string; // CSS selector
  title: string;
  body: string;
  placement: "bottom" | "top" | "center";
};

const steps: Step[] = [
  {
    target: "header",
    title: "Quick navigation",
    body: "Jump to any section with ⌘K, or use the nav links. Press ? anywhere to see all shortcuts.",
    placement: "bottom",
  },
  {
    target: "#demo",
    title: "Try the live demo",
    body: "Two working demos wired to a real model — diagnostic chat and document intelligence. No login required.",
    placement: "top",
  },
  {
    target: "#assessment",
    title: "Find your stage",
    body: "Take the 30-second ops maturity check. Get a tailored read on where Cadence would help most.",
    placement: "top",
  },
  {
    target: "#cta",
    title: "Get access",
    body: "Join the waitlist with your work email — we'll send a private link within 48 hours.",
    placement: "top",
  },
];

export function GuidedTour() {
  const [active, setActive] = React.useState(false);
  const [stepIdx, setStepIdx] = React.useState(0);
  const [rect, setRect] = React.useState<DOMRect | null>(null);
  const [viewport, setViewport] = React.useState({ width: 1200, height: 800 });

  const dismiss = React.useCallback(() => {
    setActive(false);
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
  }, []);

  // Only show on first visit
  React.useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY)) return;
    } catch {
      return;
    }
    const t = setTimeout(() => setActive(true), 1800);
    return () => clearTimeout(t);
  }, []);

  // Scroll target into view ONLY when the active step changes (never inside the scroll listener)
  React.useEffect(() => {
    if (!active) return;
    const step = steps[stepIdx];
    const el = document.querySelector(step.target);
    if (!el) return;

    if (step.target === "header") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    } else {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
    }

    const timer = setTimeout(() => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setRect(el.getBoundingClientRect());
    }, 350);

    return () => clearTimeout(timer);
  }, [active, stepIdx]);

  // Passive position tracking on scroll/resize + Escape key to dismiss
  React.useEffect(() => {
    if (!active) return;
    let rafId: number | null = null;

    const syncRect = () => {
      if (rafId !== null) return;
      rafId = window.requestAnimationFrame(() => {
        rafId = null;
        const step = steps[stepIdx];
        const el = document.querySelector(step.target);
        if (el) {
          setViewport({ width: window.innerWidth, height: window.innerHeight });
          setRect(el.getBoundingClientRect());
        }
      });
    };

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        dismiss();
      }
    };

    syncRect();
    window.addEventListener("scroll", syncRect, { passive: true });
    window.addEventListener("resize", syncRect, { passive: true });
    window.addEventListener("keydown", onKeyDown);

    return () => {
      if (rafId !== null) window.cancelAnimationFrame(rafId);
      window.removeEventListener("scroll", syncRect);
      window.removeEventListener("resize", syncRect);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [active, stepIdx, dismiss]);

  function next() {
    if (stepIdx < steps.length - 1) {
      setStepIdx((i) => i + 1);
    } else {
      dismiss();
    }
  }

  const step = steps[stepIdx];
  const isLast = stepIdx === steps.length - 1;

  const tooltipLeft = rect
    ? Math.min(Math.max(rect.left, 16), Math.max(16, viewport.width - 320 - 16))
    : 16;

  const rawTop = rect
    ? step.placement === "bottom"
      ? rect.bottom + 12
      : step.placement === "top"
        ? rect.top - 180
        : rect.bottom + 12
    : 16;
  const tooltipTop = Math.min(Math.max(rawTop, 16), Math.max(16, viewport.height - 200));

  return (
    <AnimatePresence>
      {active && rect ? (
        <>
          {/* spotlight overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-[2px]"
            style={{
              boxShadow: `0 0 0 9999px rgba(0,0,0,0.5)`,
              borderRadius: 12,
            }}
            onClick={dismiss}
          >
            {/* clear "hole" using mask */}
            <div
              className="absolute"
              style={{
                left: rect.left - 6,
                top: rect.top - 6,
                width: rect.width + 12,
                height: rect.height + 12,
                borderRadius: 12,
                boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)",
                border: "1px solid oklch(0.985 0 0 / 0.3)",
              }}
            />
          </motion.div>

          {/* tooltip card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.25 }}
            className="fixed z-[61] w-80 rounded-xl border border-border bg-card p-4 shadow-2xl"
            style={{
              left: tooltipLeft,
              top: tooltipTop,
            }}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
                  Tour · {stepIdx + 1} / {steps.length}
                </div>
                <h3 className="mt-1 text-sm font-semibold text-foreground">
                  {step.title}
                </h3>
              </div>
              <button
                onClick={dismiss}
                aria-label="Close tour"
                className="text-muted-foreground transition-colors hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              {step.body}
            </p>
            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                {steps.map((_, i) => (
                  <span
                    key={i}
                    className={
                      i === stepIdx
                        ? "h-1.5 w-4 rounded-full bg-foreground"
                        : "h-1.5 w-1.5 rounded-full bg-muted-foreground/30"
                    }
                  />
                ))}
              </div>
              <button
                onClick={next}
                className="inline-flex h-7 items-center gap-1 rounded-md bg-foreground px-3 text-xs font-medium text-background transition-all hover:translate-y-[-1px]"
              >
                {isLast ? (
                  <>
                    <Check className="h-3 w-3" />
                    Done
                  </>
                ) : (
                  "Next →"
                )}
              </button>
            </div>
          </motion.div>
        </>
      ) : null}
    </AnimatePresence>
  );
}
