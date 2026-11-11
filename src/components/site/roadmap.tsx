"use client";

import { motion } from "framer-motion";
import { CheckCircle2, Circle, Sparkles } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";

type Item = {
  status: "shipped" | "next" | "later";
  title: string;
  detail: string;
  quarter: string;
};

const roadmap: { heading: string; items: Item[] }[] = [
  {
    heading: "Shipped in Preview",
    items: [
      {
        status: "shipped",
        title: "Document intelligence (Text & URL)",
        detail:
          "Paste an invoice, contract, or SOP, or fetch a public URL via SSRF-guarded ingestion to extract fields, anomalies, and next moves.",
        quarter: "Live",
      },
      {
        status: "shipped",
        title: "Structured diagnostic reasoning",
        detail:
          "Interactive analyst chat with explicit separation of supplied evidence, detected conditions, and deterministic fallback support.",
        quarter: "Live",
      },
      {
        status: "shipped",
        title: "Application security hardening",
        detail:
          "DNS-verified SSRF protection, prompt-injection delimiters, rate limiting, CSP/HSTS headers, and PII-redacted structured logging.",
        quarter: "Live",
      },
    ],
  },
  {
    heading: "Next",
    items: [
      {
        status: "next",
        title: "Direct file upload (PDF, DOCX, XLSX)",
        detail:
          "Upload multi-page vendor PDFs and spreadsheets directly into the analyzer without copy-pasting text.",
        quarter: "Planned",
      },
      {
        status: "next",
        title: "Configurable diagnostic thresholds",
        detail:
          "Define custom organization rules — such as custom PO variance tolerances and mandatory approval tiers.",
        quarter: "Planned",
      },
      {
        status: "next",
        title: "ERP & Slack connectors",
        detail:
          "Native OAuth integrations for QuickBooks, NetSuite, DocuSign, and Slack notification routing.",
        quarter: "Planned",
      },
    ],
  },
  {
    heading: "Later",
    items: [
      {
        status: "later",
        title: "SSO, SCIM & RBAC",
        detail:
          "Enterprise SAML/OIDC authentication, role-based access control, and multi-entity workspace isolation.",
        quarter: "Roadmap",
      },
      {
        status: "later",
        title: "SOC 2 Type II & audit export",
        detail:
          "Formal third-party compliance attestation and immutable, exportable diagnostic audit logs.",
        quarter: "Roadmap",
      },
      {
        status: "later",
        title: "Private VPC deployment & API",
        detail:
          "Run Cadence in your own cloud environment with bring-your-own-model (BYOM) and programmatic REST endpoints.",
        quarter: "Roadmap",
      },
    ],
  },
];

const statusConfig = {
  shipped: { icon: CheckCircle2, cls: "text-cadence", label: "Shipped" },
  next: { icon: Sparkles, cls: "text-foreground", label: "Next" },
  later: { icon: Circle, cls: "text-muted-foreground/40", label: "Later" },
} as const;

export function Roadmap() {
  return (
    <section id="roadmap" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Roadmap"
          title="What's live in preview. What's planned next."
          description="A transparent view of what is implemented in this repository today versus planned capabilities for upcoming releases."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
          {roadmap.map((col, ci) => (
            <motion.div
              key={col.heading}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: ci * 0.08 }}
              className="flex flex-col gap-3"
            >
              <div className="flex items-center gap-2 px-1">
                <span
                  className={cn(
                    "h-1.5 w-1.5 rounded-full",
                    col.heading.startsWith("Shipped") && "bg-cadence",
                    col.heading === "Next" && "bg-foreground",
                    col.heading === "Later" && "bg-muted-foreground/30",
                  )}
                />
                <h3 className="text-sm font-medium text-foreground">
                  {col.heading}
                </h3>
                <span className="text-xs text-muted-foreground/50">
                  {col.items.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {col.items.map((item) => {
                  const cfg = statusConfig[item.status];
                  return (
                    <div
                      key={item.title}
                      className="card-glow group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 transition-all duration-300 hover:-translate-y-0.5 hover:border-foreground/25 hover:shadow-[0_12px_30px_-16px_oklch(0_0_0/0.4)]"
                      onMouseMove={(e) => {
                        const r = e.currentTarget.getBoundingClientRect();
                        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <cfg.icon className={cn("h-4 w-4", cfg.cls)} />
                          <span className="text-sm font-medium text-foreground">
                            {item.title}
                          </span>
                        </div>
                        <span className="shrink-0 rounded-md border border-border bg-secondary/30 px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {item.quarter}
                        </span>
                      </div>
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        {item.detail}
                      </p>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
