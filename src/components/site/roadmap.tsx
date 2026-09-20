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
    heading: "Shipped",
    items: [
      {
        status: "shipped",
        title: "Document intelligence v2",
        detail: "Paste a URL or contract — get extracted fields, anomalies, and prescriptions.",
        quarter: "Now",
      },
      {
        status: "shipped",
        title: "Reasoning traces",
        detail: "Every chat answer shows the chain — records parsed, rules applied, bottleneck located.",
        quarter: "Now",
      },
      {
        status: "shipped",
        title: "SOC 2 Type II",
        detail: "Annual audit complete. Controls continuously monitored.",
        quarter: "Now",
      },
    ],
  },
  {
    heading: "Next",
    items: [
      {
        status: "next",
        title: "File upload (PDF, DOCX, XLSX)",
        detail: "Drag-and-drop documents directly into the demo — no paste required.",
        quarter: "Q4",
      },
      {
        status: "next",
        title: "Scheduled diagnostics",
        detail: "Cadence runs a diagnostic on your data every Monday and emails you the top 3 moves.",
        quarter: "Q4",
      },
      {
        status: "next",
        title: "Custom diagnostic rules",
        detail: "Teach Cadence your team's specific thresholds — e.g. flag any invoice > $50k.",
        quarter: "Q4",
      },
    ],
  },
  {
    heading: "Later",
    items: [
      {
        status: "later",
        title: "Multi-org workspaces",
        detail: "For holding companies and finance shared-service centers managing multiple entities.",
        quarter: "Q1",
      },
      {
        status: "later",
        title: "Private deployment",
        detail: "Run Cadence in your own VPC. Bring your own model. Full data residency control.",
        quarter: "Q1",
      },
      {
        status: "later",
        title: "Cadence API",
        detail: "Programmatic access to diagnostics — embed the analyst in your internal tools.",
        quarter: "Q2",
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
          title="What's shipped. What's next."
          description="We ship continuously. Here's what's live, what's in flight, and what's on the horizon."
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
                    col.heading === "Shipped" && "bg-cadence",
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
                      className="card-glow group relative flex flex-col gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25"
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
