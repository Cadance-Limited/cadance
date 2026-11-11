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
      "Both surface operational metrics. The difference starts when you need to diagnose unstructured documents.",
  },
  {
    label: "Diagnoses why a document or workflow stalled",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Dashboards stop at the chart. Cadence structures the supplied evidence, rules, and bottlenecks into a clear diagnostic trace.",
  },
  {
    label: "Reads pasted invoices, contracts & SOPs",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Paste document text or provide an SSRF-validated public URL. Cadence extracts key fields and flags discrepancies.",
  },
  {
    label: "Prescribes ranked next moves",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Returns a numbered list of recommended actions with a one-sentence rationale tied to the supplied text.",
  },
  {
    label: "Verifies invoice subtotal + tax arithmetic",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Programmatically checks whether stated Subtotal + Tax equals the billed Total and flags undeclared surcharges or missing POs.",
  },
  {
    label: "Distinguishes supplied facts from assumptions",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Explicitly separates facts present in your input from operational assumptions, without inventing unverified metrics.",
  },
  {
    label: "Deterministic fallback when external AI is offline",
    dashboards: "partial",
    cadence: "yes",
    detail:
      "Includes a built-in deterministic rule engine so document extraction and diagnostic triage remain available even without external LLM keys.",
  },
  {
    label: "Native ERP & Slack OAuth connectors",
    dashboards: "partial",
    cadence: "partial",
    detail:
      "Pasted text and URL ingestion are live today in v1; direct two-way connectors for QuickBooks, NetSuite, and Slack are on the product roadmap.",
  },
  {
    label: "Zero-setup interactive evaluation",
    dashboards: "no",
    cadence: "yes",
    detail:
      "Test both the diagnostic chat and document intelligence analyzer directly in the browser without creating an account.",
  },
];

const cellConfig: Record<Cell, { icon: typeof Check; cls: string; label: string }> = {
  yes: { icon: Check, cls: "text-cadence", label: "Yes" },
  no: { icon: X, cls: "text-muted-foreground/40", label: "No" },
  partial: { icon: Minus, cls: "text-muted-foreground/70", label: "Partial / Roadmap" },
};

export function Comparison() {
  const [open, setOpen] = React.useState<number | null>(null);

  return (
    <section className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Cadence vs. dashboards"
          title="Dashboards describe. Cadence prescribes."
          description="A dashboard tells you a metric moved. Cadence inspects the underlying document or workflow question and outlines the next steps. Click any row for details."
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
                  type="button"
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
      </div>
    </section>
  );
}
