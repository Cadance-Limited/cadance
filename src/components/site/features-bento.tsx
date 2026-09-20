"use client";

import { motion } from "framer-motion";
import {
  Activity,
  FileText,
  GitBranch,
  ListChecks,
  Plug,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";

type Feature = {
  icon: LucideIcon;
  title: string;
  description: string;
  span?: "wide" | "tall" | "default";
  visual?: React.ReactNode;
};

const features: Feature[] = [
  {
    icon: Sparkles,
    title: "Diagnostic chat that reasons",
    description:
      "Ask a question in plain English. Cadence shows its work — the records it parsed, the rules it applied, and the bottleneck it located — before it ever hands you an answer.",
    span: "wide",
    visual: <ReasoningVisual />,
  },
  {
    icon: FileText,
    title: "Reads your documents",
    description:
      "Invoices, contracts, SOPs, vendor PDFs. Drop a URL or paste the text — Cadence extracts the fields that matter and flags the ones that don't add up.",
    visual: <DocsVisual />,
  },
  {
    icon: ListChecks,
    title: "Structured prescriptions",
    description:
      "Not vibes — a ranked list of next moves, with the estimated hours recovered and the owner who should pick it up.",
    visual: <PrescriptionVisual />,
  },
  {
    icon: Activity,
    title: "Anomaly detection",
    description:
      "Outlier pricing, duplicate line items, terms that drift from your templates. Surfaced before they cost you a quarter.",
    visual: <AnomalyVisual />,
  },
  {
    icon: GitBranch,
    title: "Workflow that ships",
    description:
      "Every prescription turns into a draft rule, an approval queue, and a 14-day review — wired to the tools your team already lives in.",
    span: "default",
    visual: <WorkflowVisual />,
  },
  {
    icon: Plug,
    title: "Integrations, not exports",
    description:
      "Connect QuickBooks, NetSuite, DocuSign, and Slack. Cadence reads and writes back — no CSV ferries required.",
    span: "default",
    visual: <IntegrationsVisual />,
  },
];

export function FeaturesBento() {
  return (
    <section id="features" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Capabilities"
          title="An analyst that diagnoses, not just describes."
          description="Most tools hand you a chart and walk away. Cadence reads your operations, reasons through the friction, and prescribes the fix."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-5">
          {features.map((f, i) => (
            <BentoCard key={f.title} feature={f} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}

function BentoCard({ feature, index }: { feature: Feature; index: number }) {
  const { icon: Icon, title, description, span = "default", visual } = feature;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.06 }}
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/20",
        span === "wide" && "md:col-span-2",
      )}
    >
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-secondary text-foreground">
          <Icon className="h-4 w-4" />
        </span>
        <h3 className="text-base font-medium text-foreground">{title}</h3>
      </div>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>
      {visual ? (
        <div className="mt-5 flex-1">{visual}</div>
      ) : null}
    </motion.div>
  );
}

/* ---------- Inline card visuals ---------- */

function ReasoningVisual() {
  const steps = [
    "Parsed 1,284 AP records · 11 outliers",
    "Cross-referenced vendor SLA vs. payment dates",
    "Bottleneck: manual 3-way match < $5k",
  ];
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Reasoning trace
      </div>
      <ol className="flex flex-col gap-2.5">
        {steps.map((s, i) => (
          <li
            key={i}
            className="flex items-center gap-2.5 text-xs text-foreground/80"
          >
            <span className="flex h-4 w-4 items-center justify-center rounded-full border border-cadence/40 bg-cadence/10 text-[9px] font-semibold text-cadence">
              {i + 1}
            </span>
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

function DocsVisual() {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 flex items-center justify-between text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span>invoice_4291.pdf</span>
        <span className="text-cadence">parsed</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {[
          ["Vendor", "Acme Logistics"],
          ["Net terms", "Net 30 → flagged as Net 45"],
          ["Total", "$48,210.00"],
        ].map(([k, v]) => (
          <div
            key={k}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <span className="text-muted-foreground">{k}</span>
            <span className="text-right font-medium text-foreground">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function PrescriptionVisual() {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Move #1
      </div>
      <div className="text-sm font-medium text-foreground">
        Auto-approve invoices &lt; $5k
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xl font-semibold tracking-tight text-foreground">
          6.2
        </span>
        <span className="text-xs text-muted-foreground">hrs / week</span>
      </div>
    </div>
  );
}

function AnomalyVisual() {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        flagged this week
      </div>
      <div className="flex items-end gap-1.5">
        {[40, 65, 30, 80, 55, 95, 45, 60, 35, 72, 50, 88].map((h, i) => (
          <div
            key={i}
            className={cn(
              "w-2 rounded-sm",
              i === 5 || i === 11 ? "bg-cadence" : "bg-foreground/15",
            )}
            style={{ height: `${h * 0.6}px` }}
          />
        ))}
      </div>
      <div className="mt-2 text-[11px] text-muted-foreground">
        2 outliers above 2σ · auto-flagged
      </div>
    </div>
  );
}

function WorkflowVisual() {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        prescription → workflow
      </div>
      <div className="flex items-center gap-2 text-xs">
        {["Draft rule", "Approve", "Review"].map((t, i) => (
          <div key={t} className="flex items-center gap-2">
            <span className="rounded-md border border-border bg-card px-2 py-1 text-foreground">
              {t}
            </span>
            {i < 2 ? (
              <span className="text-muted-foreground">→</span>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function IntegrationsVisual() {
  const apps = ["QuickBooks", "NetSuite", "DocuSign", "Slack"];
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        connected
      </div>
      <div className="flex flex-wrap gap-2">
        {apps.map((a) => (
          <span
            key={a}
            className="rounded-md border border-border bg-card px-2.5 py-1 text-xs text-foreground"
          >
            {a}
          </span>
        ))}
      </div>
    </div>
  );
}
