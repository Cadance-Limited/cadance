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
    title: "Diagnostic chat that shows its reasoning",
    description:
      "Ask an operations question in plain English. Cadence structures every response into supplied evidence, detected conditions, ranked prescriptions, and the next open question.",
    span: "wide",
    visual: <ReasoningVisual />,
  },
  {
    icon: FileText,
    title: "Reads invoices, contracts, and SOPs",
    description:
      "Paste document text or provide a public URL — Cadence extracts key fields, checks invoice arithmetic, and flags terms that warrant review.",
    visual: <DocsVisual />,
  },
  {
    icon: ListChecks,
    title: "Structured prescriptions",
    description:
      "Returns a ranked list of next moves with a clear one-sentence rationale based strictly on the evidence you supply.",
    visual: <PrescriptionVisual />,
  },
  {
    icon: Activity,
    title: "Rule & AI anomaly flagging",
    description:
      "Surfaces arithmetic discrepancies, undeclared surcharges, missing PO references, and Net-terms modifications for human review.",
    visual: <AnomalyVisual />,
  },
  {
    icon: GitBranch,
    title: "Actionable workflow playbooks",
    description:
      "Translates diagnostic findings into clear operational steps — defining tolerance thresholds, exception ownership, and review cadences.",
    span: "default",
    visual: <WorkflowVisual />,
  },
  {
    icon: Plug,
    title: "Roadmap ERP & Slack connectors",
    description:
      "Pasted text and SSRF-safe URL ingestion are live today. Direct connectors for QuickBooks, NetSuite, DocuSign, and Slack are on the product roadmap.",
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
          description="Most tools hand you a chart and walk away. Cadence reads your operational documents, reasons through the friction, and outlines the next move."
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
  const onMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
  };
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: (index % 3) * 0.06 }}
      onMouseMove={onMove}
      className={cn(
        "card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25",
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
      {visual ? <div className="mt-5 flex-1">{visual}</div> : null}
    </motion.div>
  );
}

/* ---------- Inline card visuals (labeled as sample illustrations) ---------- */

function ReasoningVisual() {
  const steps = [
    "Supplied evidence: sample Q3 invoice & PO parameters",
    "Detected condition: Net-30 to Net-45 drift & missing PO",
    "Prescription: require PO reference prior to approval routing",
  ];
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        Sample reasoning trace
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
        <span>sample_invoice_4291</span>
        <span className="text-cadence">parsed</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {[
          ["Vendor", "Acme Logistics Co."],
          ["Net terms", "Net 30 → flagged as Net 45"],
          ["Total due", "$52,307.85"],
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
        Recommended Move #1
      </div>
      <div className="text-sm font-medium text-foreground">
        Hold undeclared surcharge pending proof
      </div>
      <div className="mt-1 flex items-baseline gap-1.5">
        <span className="text-xs font-medium text-cadence">
          Human-in-the-loop verification
        </span>
      </div>
    </div>
  );
}

function AnomalyVisual() {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        illustrative anomaly distribution
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
        Flags missing POs, fee drift &amp; math mismatches
      </div>
    </div>
  );
}

function WorkflowVisual() {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        diagnostic → human review
      </div>
      <div className="flex items-center gap-2 text-xs">
        {["Extract", "Verify", "Decide"].map((t, i) => (
          <div key={t} className="flex items-center gap-2">
            <span className="rounded-md border border-border bg-card px-2 py-1 text-foreground">
              {t}
            </span>
            {i < 2 ? <span className="text-muted-foreground">→</span> : null}
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
        planned roadmap connectors
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
