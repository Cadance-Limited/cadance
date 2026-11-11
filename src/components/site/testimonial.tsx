"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

type Scenario = {
  quote: string;
  name: string;
  initials: string;
  role: string;
  company: string;
};

/**
 * Clearly labeled illustrative workflow scenarios (no fabricated customer identities or testimonials).
 */
const scenarios: Scenario[] = [
  {
    quote:
      "Illustrative AP workflow: Instead of manually checking every low-dollar invoice line by line, Cadence extracts the vendor, subtotal, tax, and total, verifies the math, and flags missing PO numbers before approval routing.",
    name: "Scenario 01 · Accounts Payable",
    initials: "01",
    role: "Illustrative workflow walkthrough",
    company: "Invoice & 3-way match triage",
  },
  {
    quote:
      "Illustrative vendor audit: When a logistics invoice includes an uncontracted fuel surcharge or shifts payment terms from Net 30 to Net 45, Cadence highlights the exact discrepancy and recommends holding the disputed delta.",
    name: "Scenario 02 · Freight & Billing Audit",
    initials: "02",
    role: "Illustrative workflow walkthrough",
    company: "Fee drift & terms verification",
  },
  {
    quote:
      "Illustrative contract triage: Before a vendor agreement enters the legal queue, Cadence parses the text to surface automatic renewal clauses, liability language, and missing approval thresholds.",
    name: "Scenario 03 · Procurement & Legal",
    initials: "03",
    role: "Illustrative workflow walkthrough",
    company: "Pre-review clause extraction",
  },
];

export function TestimonialCarousel() {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const go = React.useCallback(
    (dir: number) =>
      setIndex((i) => (i + dir + scenarios.length) % scenarios.length),
    [],
  );

  // auto-advance every 7s, paused on hover
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % scenarios.length);
    }, 7000);
    return () => clearInterval(t);
  }, [paused]);

  const active = scenarios[index];

  return (
    <section
      className="relative py-24 sm:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-label="Illustrative workflow scenarios"
    >
      <div className="mx-auto max-w-4xl px-6">
        <div className="noise-overlay relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-foreground/[0.04] blur-3xl" />
          <div className="flex items-center justify-between gap-2">
            <Quote className="h-7 w-7 text-muted-foreground/40" aria-hidden="true" />
            <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
              Illustrative use-case scenario
            </span>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <blockquote className="mt-5 text-balance text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl md:text-[1.625rem]">
                &ldquo;{active.quote}&rdquo;
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-foreground">
                  {active.initials}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {active.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {active.role} · {active.company}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* controls */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <div className="flex items-center gap-2">
              {scenarios.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setIndex(i)}
                  aria-label={`Go to scenario ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index
                      ? "w-6 bg-foreground"
                      : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => go(-1)}
                aria-label="Previous scenario"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                aria-label="Next scenario"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
