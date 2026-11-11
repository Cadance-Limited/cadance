"use client";

import { motion } from "framer-motion";
import { SectionHeading } from "./section-heading";
import { useCountUp, useInView } from "@/hooks/use-count-up";

type ContextStat = {
  target: number;
  suffix: string;
  decimals: number;
  label: string;
  context: string;
  source: string;
};

const stats: ContextStat[] = [
  {
    target: 3,
    suffix: " classes",
    decimals: 0,
    label: "first-class operational document schemas",
    context:
      "Cadence is tuned specifically around Invoices, Vendor Contracts, and Standard Operating Procedures (SOPs), with automatic document-type detection when set to Auto.",
    source: "Engine specification · src/lib/diagnostics-engine.ts",
  },
  {
    target: 8,
    suffix: "k chars",
    decimals: 0,
    label: "bounded document window per analysis",
    context:
      "Each pasted document or SSRF-validated webpage is sanitized, stripped of script/style tags, and bounded to 8,000 characters to guarantee predictable latency and token cost.",
    source: "Analyzer route policy · src/app/api/analyze/route.ts",
  },
  {
    target: 4,
    suffix: " outputs",
    decimals: 0,
    label: "structured diagnostic sections per run",
    context:
      "Every document analysis produces a normalized schema: executive summary, extracted key fields with flags, severity-ranked anomalies, and actionable recommendations.",
    source: "Normalized output contract · normalizeAnalysisPayload()",
  },
  {
    target: 0,
    suffix: " silent",
    decimals: 0,
    label: "invented metrics or unapproved actions",
    context:
      "Cadence never fabricates hours recovered or historical records not supplied in the prompt, and clearly badges whether an output came from Live AI or the deterministic rule engine.",
    source: "Non-hallucination guardrail · Phase 6 verification",
  },
];

export function StatsContext() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Architecture in context"
          title="Every number reflects an actual engineering constraint."
          description="Instead of unverifiable marketing claims, here are the exact operational bounds and guarantees implemented in the Cadence codebase."
        />

        <div ref={ref} className="mt-12 grid gap-4 md:grid-cols-2 md:gap-5">
          {stats.map((s, i) => (
            <StatCard key={s.label} stat={s} index={i} start={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  stat: s,
  index,
  start,
}: {
  stat: ContextStat;
  index: number;
  start: boolean;
}) {
  const value = useCountUp(s.target, { decimals: s.decimals, start });
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (index % 2) * 0.08 }}
      className="card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25 sm:p-7"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-3xl font-semibold tracking-tight text-foreground tabular-nums sm:text-4xl">
          {value}
          <span className="text-foreground">{s.suffix}</span>
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
  );
}
