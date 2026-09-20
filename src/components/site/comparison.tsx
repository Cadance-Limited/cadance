"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";

type Cell = "yes" | "no" | "partial";

const rows: {
  label: string;
  dashboards: Cell;
  cadence: Cell;
  detail: string;
}[] = [
  {
    label: "Shows what happened",
    dashboards: "yes",
    cadence: "yes",
    detail:
      "Both show you the number. The difference starts when you ask why it moved.",
  },
  {
    label: "Diagnoses why it happened",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Dashboards stop at the chart. Cadence traces the chain — the records, the rules, the bottleneck — and shows its work.",
  },
  {
    label: "Reads invoices, contracts & SOPs",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Drop in a PDF or paste text. Cadence extracts the fields that matter and flags the ones that don't add up.",
  },
  {
    label: "Prescribes ranked next moves",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Not vibes — a numbered list of moves, each with a rationale and an estimated hours-recovered figure.",
  },
  {
    label: "Turns each move into a draft rule",
    dashboards: "no",
    cadence: "yes",
    detail:
      "One click turns a prescription into a draft workflow rule wired to your approval queue.",
  },
  {
    label: "Flags anomalies before you ask",
    dashboards: "partial",
    cadence: "yes",
    detail:
      "Dashboards need you to build the alert. Cadence surfaces outliers — pricing drift, duplicate line items, term changes — on its own.",
  },
  {
    label: "Talks to QuickBooks / NetSuite / Slack",
    dashboards: "partial",
    cadence: "yes",
    detail:
      "Cadence reads and writes back — no CSV ferries. Dashboards mostly read, and only what you wire up.",
  },
  {
    label: "Explains its reasoning in plain English",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Every Cadence answer comes with a visible reasoning trace. No black-box predictions.",
  },
  {
    label: "Setup in minutes, no data team",
    dashboards: "partial",
    cadence: "yes",
    detail:
      "Connect an integration or paste a URL. No schema, no implementation project, no six-week onboarding.",
  },
];

const cellConfig: Record<Cell, { icon: typeof Check; cls: string; label: string }> = {
  yes: { icon: Check, cls: "text-cadence", label: "Yes" },
  no: { icon: X, cls: "text-muted-foreground/40", label: "No" },
  partial: { icon: Minus, cls: "text-muted-foreground/70", label: "Partial" },
};

export function Comparison() {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <section className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Cadence vs. dashboards"
          title="Dashboards describe. Cadence prescribes."
          description="A dashboard tells you the number went up. Cadence tells you why, where the friction is, and the three moves that fix it. Click any row for the rationale."
        />

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="mt-12 overflow-hidden rounded-2xl border border-border"
        >
          {/* header row */}
          <div className="grid grid-cols-[1fr_110px_110px] border-b border-border bg-secondary/30 sm:grid-cols-[1fr_160px_160px]">
            <div className="px-4 py-4 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">
              Capability
            </div>
            <div className="border-l border-border px-3 py-4 text-center text-xs font-medium uppercase tracking-wide text-muted-foreground sm:px-6">
              Dashboards
            </div>
            <div className="relative border-l border-border bg-foreground/[0.03] px-3 py-4 text-center sm:px-6">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cadence/50 to-transparent" />
              <span className="text-xs font-semibold uppercase tracking-wide text-foreground">
                Cadence
              </span>
            </div>
          </div>

          {/* body rows */}
          {rows.map((row, i) => {
            const d = cellConfig[row.dashboards];
            const c = cellConfig[row.cadence];
            const isOpen = open === i;
            return (
              <div
                key={row.label}
                className={cn(
                  "border-b border-border last:border-b-0",
                  i % 2 === 1 && !isOpen && "bg-secondary/10",
                )}
              >
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="grid w-full grid-cols-[1fr_110px_110px] cursor-pointer items-center text-left transition-colors hover:bg-secondary/20 sm:grid-cols-[1fr_160px_160px]"
                  aria-expanded={isOpen}
                >
                  <div className="flex items-center gap-2 px-4 py-3.5 text-sm text-foreground/90 sm:px-6">
                    <span className="flex-1">{row.label}</span>
                    <ChevronDown
                      className={cn(
                        "h-3.5 w-3.5 shrink-0 text-muted-foreground/50 transition-transform",
                        isOpen && "rotate-180",
                      )}
                    />
                  </div>
                  <div className="flex items-center justify-center border-l border-border px-3 py-3.5">
                    <d.icon className={cn("h-4 w-4", d.cls)} />
                    <span className="sr-only">{d.label}</span>
                  </div>
                  <div className="flex items-center justify-center border-l border-border bg-foreground/[0.02] px-3 py-3.5">
                    <c.icon className={cn("h-4 w-4", c.cls)} />
                    <span className="sr-only">{c.label}</span>
                  </div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="grid grid-cols-[1fr_110px_110px] gap-3 px-4 pb-4 pt-1 sm:grid-cols-[1fr_160px_160px] sm:px-6">
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          {row.detail}
                        </p>
                        <div className="hidden sm:block" />
                        <div className="hidden sm:block" />
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            );
          })}
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-6 text-center text-sm text-muted-foreground"
        >
          The dashboard isn&apos;t dead — it just isn&apos;t enough. Cadence
          sits on top of the tools you already have and does the thinking.
        </motion.p>
      </div>
    </section>
  );
}
