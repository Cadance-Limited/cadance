"use client";

import { useCountUp, useInView } from "@/hooks/use-count-up";

const domains = [
  "Accounts Payable",
  "Vendor Contracts",
  "Procurement Ops",
  "Freight & Logistics",
  "SOP Compliance",
  "Spend Audit",
];

// Verifiable architectural parameters of the Cadence engine (no fabricated customer metrics)
const stats = [
  { target: 3, suffix: " types", decimals: 0, label: "core document classes (Invoices, Contracts, SOPs)" },
  { target: 8, suffix: "k chars", decimals: 0, label: "structured extraction window per request" },
  { target: 4, suffix: " stages", decimals: 0, label: "reasoning, fields, anomalies & prescriptions" },
  { target: 0, suffix: " silent", decimals: 0, label: "unverified auto-approvals without human review" },
];

export function TrustBar() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.3 });

  return (
    <section className="relative border-y border-border bg-secondary/20">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Purpose-built for document-heavy operational workflows
        </p>
        <div className="mask-fade-x mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14">
          {domains.map((name) => (
            <span
              key={name}
              className="text-lg font-semibold tracking-tight text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              {name}
            </span>
          ))}
        </div>

        <div
          ref={ref}
          className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4"
        >
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} start={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}

function StatCard({
  stat,
  start,
}: {
  stat: (typeof stats)[number];
  start: boolean;
}) {
  const value = useCountUp(stat.target, {
    decimals: stat.decimals,
    start,
  });
  return (
    <div className="bg-background p-5 text-center sm:p-6">
      <div className="text-2xl font-semibold tracking-tight text-foreground tabular-nums sm:text-3xl">
        {value}
        <span className="text-foreground">{stat.suffix}</span>
      </div>
      <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
        {stat.label}
      </div>
    </div>
  );
}
