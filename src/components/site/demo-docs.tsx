"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  Check,
  FileText,
  Lightbulb,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

type KeyField = {
  label: string;
  value: string;
  flagged?: boolean;
  note?: string;
};
type Anomaly = { title: string; severity: "low" | "medium" | "high"; note: string };
type Recommendation = {
  title: string;
  rationale: string;
  estHoursRecovered?: string | null;
};
type Analysis = {
  ok: boolean;
  docType?: string;
  summary?: string;
  keyFields?: KeyField[];
  anomalies?: Anomaly[];
  recommendations?: Recommendation[];
  source?: { title: string; url: string | null; publishedTime: string | null };
  error?: string;
  fallback?: boolean;
};

type Mode = "text" | "url";
type DocType = "auto" | "invoice" | "contract" | "sop";

const SAMPLE_INVOICE = `INVOICE
Invoice No: INV-2024-4291
Vendor: Acme Logistics Co.
Bill To: Northwind Trading, 548 Market St, San Francisco, CA
Issue Date: 2024-09-14
Due Date: 2024-10-29
Terms: Net 45

Line items:
  - Freight forwarding (Q3 peak surcharge) ......... $31,800.00
  - Warehousing — 6 weeks @ $2,400/wk ............... $14,400.00
  - Fuel surcharge (undeclared) ..................... $ 2,010.00

Subtotal: $48,210.00
Tax (8.5%): $4,097.85
Total due: $52,307.85

Notes: Net terms extended from Net 30 to Net 45 at vendor request. Fuel surcharge line item not present on prior 4 invoices. No PO referenced.`;

const DOC_TYPE_LABEL: Record<string, string> = {
  invoice: "Invoice",
  contract: "Contract",
  sop: "SOP",
  other: "Document",
};

export function DemoDocs() {
  const [mode, setMode] = React.useState<Mode>("text");
  const [docType, setDocType] = React.useState<DocType>("auto");
  const [text, setText] = React.useState("");
  const [url, setUrl] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [result, setResult] = React.useState<Analysis | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  async function analyze() {
    setError(null);
    setResult(null);
    const payload =
      mode === "url"
        ? { url: url.trim(), docType }
        : { text: text.trim(), docType };
    if (mode === "url" && !payload.url) {
      setError("Paste a URL first.");
      return;
    }
    if (mode === "text" && !payload.text) {
      setError("Paste a document first.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as Analysis;
      if (!data.ok) throw new Error(data.error || "Analysis failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  function loadSample() {
    setMode("text");
    setText(SAMPLE_INVOICE);
    setDocType("invoice");
    setResult(null);
    setError(null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1.25fr]">
      {/* INPUT PANEL */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            Document
          </div>
          <button
            type="button"
            onClick={loadSample}
            className="rounded-md border border-border bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Load sample invoice
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          {/* mode toggle */}
          <div className="inline-flex w-fit rounded-lg border border-border bg-secondary/40 p-0.5 text-xs">
            <ModeButton active={mode === "text"} onClick={() => setMode("text")}>
              Paste text
            </ModeButton>
            <ModeButton active={mode === "url"} onClick={() => setMode("url")}>
              <Link2 className="h-3 w-3" /> From URL
            </ModeButton>
          </div>

          {mode === "text" ? (
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Paste an invoice, contract, or SOP here…"
              className="scrollbar-cadence h-64 resize-none rounded-lg border border-border bg-background/40 p-3 font-mono text-xs leading-relaxed text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
            />
          ) : (
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com/vendor-agreement"
              className="h-11 rounded-lg border border-border bg-background/40 px-3 text-sm text-foreground placeholder:text-muted-foreground/50 focus:border-foreground/30 focus:outline-none"
            />
          )}

          {/* doc type */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">Type:</span>
            <div className="inline-flex rounded-lg border border-border bg-secondary/40 p-0.5 text-xs">
              {(["auto", "invoice", "contract", "sop"] as DocType[]).map((t) => (
                <ModeButton
                  key={t}
                  active={docType === t}
                  onClick={() => setDocType(t)}
                >
                  {t === "auto" ? "Auto" : DOC_TYPE_LABEL[t]}
                </ModeButton>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={analyze}
            disabled={loading}
            className="shimmer-border inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-all hover:translate-y-[-1px] disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {loading ? "Analyzing…" : "Analyze document"}
          </button>
          {error ? (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          ) : null}
        </div>
      </div>

      {/* RESULTS PANEL */}
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="flex items-center justify-between border-b border-border px-4 py-3 text-sm font-medium text-foreground">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-cadence" />
            Cadence analysis
          </div>
          {result?.source?.url ? (
            <a
              href={result.source.url}
              target="_blank"
              rel="noreferrer"
              className="max-w-[40%] truncate text-xs text-muted-foreground hover:text-foreground"
            >
              {result.source.title || result.source.url}
            </a>
          ) : null}
        </div>

        <div className="scrollbar-cadence flex-1 overflow-y-auto p-4">
          {loading ? (
            <AnalyzingState />
          ) : !result ? (
            <EmptyState />
          ) : (
            <AnalysisView result={result} />
          )}
        </div>
      </div>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 font-medium transition-colors",
        active
          ? "bg-background text-foreground shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function EmptyState() {
  return (
    <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-3 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary/40">
        <FileText className="h-5 w-5 text-muted-foreground" />
      </div>
      <div className="text-sm text-muted-foreground">
        Paste a document or load the sample invoice to see Cadence&apos;s
        analysis.
      </div>
      <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground/60">
        <span className="rounded-md border border-border bg-secondary/30 px-2 py-0.5">
          Tip: try the sample invoice →
        </span>
      </div>
    </div>
  );
}

function AnalyzingState() {
  const steps = [
    "Reading the document…",
    "Extracting key fields…",
    "Checking for anomalies…",
    "Drafting prescriptions…",
  ];
  return (
    <div className="flex h-full min-h-[280px] flex-col items-start justify-center gap-4 px-2">
      {steps.map((s, i) => (
        <motion.div
          key={s}
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.4, duration: 0.4 }}
          className="flex items-center gap-2.5 text-sm text-muted-foreground"
        >
          <span className="flex h-4 w-4 items-center justify-center">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-cadence" />
          </span>
          {s}
        </motion.div>
      ))}
    </div>
  );
}

function AnalysisView({ result }: { result: Analysis }) {
  const fields = result.keyFields ?? [];
  const anomalies = result.anomalies ?? [];
  const recs = result.recommendations ?? [];
  const docTypeLabel = result.docType
    ? DOC_TYPE_LABEL[result.docType] || "Document"
    : "Document";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="flex flex-col gap-5"
    >
      {/* summary */}
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-[11px] font-medium text-foreground">
          {docTypeLabel}
        </span>
        <p className="text-sm leading-relaxed text-foreground/90">
          {result.summary}
        </p>
      </div>

      {/* key fields */}
      {fields.length ? (
        <Section title="Key fields" icon={Check}>
          <div className="overflow-hidden rounded-lg border border-border">
            {fields.map((f, i) => (
              <div
                key={f.label + i}
                className={cn(
                  "flex items-start justify-between gap-3 border-b border-border px-3 py-2 text-sm last:border-b-0",
                  f.flagged && "bg-cadence/[0.04]",
                )}
              >
                <div className="min-w-0">
                  <div className="text-muted-foreground">{f.label}</div>
                  {f.note ? (
                    <div className="mt-0.5 text-[11px] text-cadence">
                      ⚠ {f.note}
                    </div>
                  ) : null}
                </div>
                <div className="text-right font-medium text-foreground">
                  {f.value || "—"}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* anomalies */}
      {anomalies.length ? (
        <Section title="Anomalies" icon={AlertTriangle}>
          <div className="flex flex-col gap-2">
            {anomalies.map((a, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-secondary/30 px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">
                    {a.title}
                  </span>
                  <SeverityBadge severity={a.severity} />
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {a.note}
                </p>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {/* recommendations */}
      {recs.length ? (
        <Section title="Prescriptions" icon={Lightbulb}>
          <div className="flex flex-col gap-2">
            {recs.map((r, i) => (
              <div
                key={i}
                className="rounded-lg border border-border bg-card p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-foreground text-[10px] font-semibold text-background">
                      {i + 1}
                    </span>
                    <div>
                      <div className="text-sm font-medium text-foreground">
                        {r.title}
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                        {r.rationale}
                      </p>
                    </div>
                  </div>
                  {r.estHoursRecovered ? (
                    <span className="shrink-0 rounded-md border border-cadence/30 bg-cadence/10 px-2 py-0.5 text-[11px] font-medium text-cadence">
                      {r.estHoursRecovered}
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Section>
      ) : null}

      {result.fallback ? (
        <div className="rounded-lg border border-border bg-secondary/30 px-3 py-2 text-xs text-muted-foreground">
          This document didn&apos;t structure cleanly — showing the raw model
          output.
        </div>
      ) : null}
    </motion.div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">
        <Icon className="h-3.5 w-3.5" />
        {title}
      </div>
      {children}
    </div>
  );
}

function SeverityBadge({ severity }: { severity?: Anomaly["severity"] }) {
  const safeSeverity: Anomaly["severity"] =
    severity === "high" || severity === "medium" ? severity : "low";
  const styles =
    safeSeverity === "high"
      ? "border-destructive/30 bg-destructive/10 text-destructive"
      : safeSeverity === "medium"
        ? "border-amber-500/30 bg-amber-500/10 text-amber-500"
        : "border-border bg-secondary text-muted-foreground";
  const label = safeSeverity[0].toUpperCase() + safeSeverity.slice(1);
  return (
    <span
      className={cn(
        "shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide",
        styles,
      )}
    >
      {label}
    </span>
  );
}
