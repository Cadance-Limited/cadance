"use client";

import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { SectionHeading } from "./section-heading";

const integrations = [
  { name: "QuickBooks", category: "Accounting · Roadmap", glyph: "QB" },
  { name: "NetSuite", category: "ERP · Roadmap", glyph: "NS" },
  { name: "DocuSign", category: "Signatures · Roadmap", glyph: "DS" },
  { name: "Slack", category: "Alerts · Roadmap", glyph: "Sl" },
  { name: "Xero", category: "Accounting · Roadmap", glyph: "Xr" },
  { name: "Notion", category: "SOPs · Roadmap", glyph: "Nt" },
  { name: "Gmail", category: "Inbox · Roadmap", glyph: "Gm" },
  { name: "Stripe", category: "Payments · Roadmap", glyph: "St" },
  { name: "AWS S3", category: "Storage · Roadmap", glyph: "Aw" },
  { name: "Drive", category: "Docs · Roadmap", glyph: "Dr" },
  { name: "Salesforce", category: "CRM · Roadmap", glyph: "SF" },
  { name: "n8n / Webhooks", category: "Automation · Roadmap", glyph: "n8" },
];

export function Integrations() {
  return (
    <section
      id="integrations"
      className="relative scroll-mt-20 py-24 sm:py-32"
    >
      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow="Integrations · Planned Roadmap"
          title="Designed to connect with the tools your team lives in."
          description="Today's preview supports direct document text and SSRF-validated URL ingestion. Native OAuth and webhook connectors for the platforms below are on the roadmap."
        />

        <div className="mt-12 grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6 md:gap-4">
          {integrations.map((it, i) => (
            <motion.div
              key={it.name}
              initial={{ opacity: 0, scale: 0.92 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ duration: 0.4, delay: (i % 6) * 0.04 }}
              className="card-glow group relative flex flex-col items-center gap-2 overflow-hidden rounded-xl border border-border bg-card p-4 transition-colors hover:border-foreground/25"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty(
                  "--mx",
                  `${e.clientX - r.left}px`,
                );
                e.currentTarget.style.setProperty(
                  "--my",
                  `${e.clientY - r.top}px`,
                );
              }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-secondary text-xs font-semibold tracking-tight text-foreground">
                {it.glyph}
              </span>
              <div className="text-center">
                <div className="text-xs font-medium text-foreground">
                  {it.name}
                </div>
                <div className="text-[10px] text-muted-foreground/70">
                  {it.category}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="mt-10 flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-secondary/20 px-6 py-5 text-center sm:flex-row sm:text-left"
        >
          <p className="text-sm text-muted-foreground">
            Want to prioritize a specific ERP or accounting connector for your workflow?
          </p>
          <a
            href="#cta"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
          >
            Share your stack on the waitlist
            <ArrowRight className="h-3.5 w-3.5" />
          </a>
        </motion.div>
      </div>
    </section>
  );
}
