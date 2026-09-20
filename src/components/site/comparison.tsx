"use client";

import { motion } from "framer-motion";
import { Check, Minus, X } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";

type Cell = "yes" | "no" | "partial";

const rows: { label: string; dashboards: Cell; cadence: Cell }[] = [
  { label: "Shows what happened", dashboards: "yes", cadence: "yes" },
  { label: "Diagnoses why it happened", dashboards: "no", cadence: "yes" },
  { label: "Reads invoices, contracts & SOPs", dashboards: "no", cadence: "yes" },
  { label: "Prescribes ranked next moves", dashboards: "no", cadence: "yes" },
  { label: "Turns each move into a draft rule", dashboards: "no", cadence: "yes" },
  { label: "Flags anomalies before you ask", dashboards: "partial", cadence: "yes" },
  { label: "Talks to QuickBooks / NetSuite / Slack", dashboards: "partial", cadence: "yes" },
  { label: "Explains its reasoning in plain English", dashboards: "no", cadence: "yes" },
  { label: "Setup in minutes, no data team", dashboards: "partial", cadence: "yes" },
];

const cellConfig: Record<Cell, { icon: typeof Check; cls: string; label: string }> = {
  yes: { icon: Check, cls: "text-cadence", label: "Yes" },
  no: { icon: X, cls: "text-muted-foreground/40", label: "No" },
  partial: { icon: Minus, cls: "text-muted-foreground/70", label: "Partial" },
};

export function Comparison() {
  return (
    <section className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Cadence vs. dashboards"
          title="Dashboards describe. Cadence prescribes."
          description="A dashboard tells you the number went up. Cadence tells you why, where the friction is, and the three moves that fix it."
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
            return (
              <div
                key={row.label}
                className={cn(
                  "grid grid-cols-[1fr_110px_110px] border-b border-border last:border-b-0 sm:grid-cols-[1fr_160px_160px]",
                  i % 2 === 1 && "bg-secondary/10",
                )}
              >
                <div className="px-4 py-3.5 text-sm text-foreground/90 sm:px-6">
                  {row.label}
                </div>
                <div className="flex items-center justify-center border-l border-border px-3 py-3.5">
                  <d.icon className={cn("h-4 w-4", d.cls)} />
                  <span className="sr-only">{d.label}</span>
                </div>
                <div className="flex items-center justify-center border-l border-border bg-foreground/[0.02] px-3 py-3.5">
                  <c.icon className={cn("h-4 w-4", c.cls)} />
                  <span className="sr-only">{c.label}</span>
                </div>
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
