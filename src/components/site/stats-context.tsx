"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "./section-heading";

type ContextStat = {
  big: string;
  label: string;
  context: string;
  source: string;
};

const stats: ContextStat[] = [
  {
    big: "1.2M+",
    label: "documents analyzed",
    context:
      "Invoices, contracts, and SOPs parsed across finance, ops, and procurement teams since launch. Each one fed back into Cadence's anomaly detection.",
    source: "Aggregate usage, last 12 months",
  },
  {
    big: "6.2 hrs",
    label: "saved per week, per team",
    context:
      "Measured as the delta between time-to-close before and after Cadence was wired into the AP cycle. The recovery comes mostly from removing manual 3-way matches under $5k.",
    source: "Median across 24 piloting teams",
  },
  {
    big: "73%",
    label: "faster contract review",
    context:
      "Vendor agreements that took 11 days to redline now take under 3. Cadence flags the risky clauses first, so legal reviews the right pages — not all of them.",
    source: "Self-reported, procurement teams",
  },
  {
    big: "98%",
    label: "anomaly recall vs. manual audit",
    context:
      "Of the anomalies a senior analyst would flag on a manual audit, Cadence surfaces 98% automatically — and catches a class of pricing-drift issues auditors routinely miss.",
    source: "Blind audit, 1,200 documents",
  },
];

export function StatsContext() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="The numbers, in context"
          title="Every stat has a method behind it."
          description="Marketing numbers are cheap. Here's what each one actually measures — and where it comes from."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-2 md:gap-5">
          {stats.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: (i % 2) * 0.08 }}
              className="card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25 sm:p-7"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
                  {s.big}
                </span>
                <span className="text-xs text-muted-foreground">{s.label}</span>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                {s.context}
              </p>
              <div className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-[11px] text-muted-foreground/60">
                <span className="h-1 w-1 rounded-full bg-cadence" />
                {s.source}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
