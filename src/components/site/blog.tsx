"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowUpRight, Clock } from "lucide-react";
import { SectionHeading } from "./section-heading";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Article = {
  category: string;
  title: string;
  excerpt: string;
  body: string[];
  readTime: string;
  date: string;
};

const articles: Article[] = [
  {
    category: "Field notes",
    title: "Why manual 3-way matching on low-dollar invoices stalls AP",
    excerpt:
      "Why the manual 3-way match survives on every small invoice — and how separating PO-matched routine spend from true exceptions removes the queue bottleneck.",
    body: [
      "Three-way matching — verifying an invoice against both the purchase order and the receiving log — is an essential financial control. However, applying the exact same multi-reviewer manual workflow to a $400 recurring software bill and a $50,000 freight invoice creates severe queue drag.",
      "When every low-dollar invoice requires sequential human sign-offs, reviewers suffer from alert fatigue. Real anomalies (such as undeclared surcharges or payment terms drifting from Net 30 to Net 45) hide inside hundreds of routine approvals.",
      "The fix is structural triage: verify subtotal/tax math and PO presence automatically at intake, fast-track PO-matched invoices within your defined variance tolerance, and route only true exceptions to a dedicated reviewer.",
    ],
    readTime: "3 min read",
    date: "Field Note 01",
  },
  {
    category: "Architecture",
    title: "Why document analyzers need deterministic guardrails",
    excerpt:
      "Large language models summarize well, but financial and operations teams need deterministic arithmetic verification and strict schema boundaries.",
    body: [
      "Handing a raw vendor invoice to an unconstrained language model introduces two risks: hallucinated savings estimates and missed arithmetic discrepancies when Subtotal + Tax does not equal the billed Total.",
      "Cadence pairs structured model prompts with a deterministic validation layer. Every output is normalized against a strict schema, untrusted document text is isolated inside XML delimiters, and invoice totals are checked programmatically.",
      "When an external model provider is unreachable or unconfigured, the deterministic engine continues to extract key fields and flag missing POs or fee drift without fabricating numbers.",
    ],
    readTime: "4 min read",
    date: "Field Note 02",
  },
  {
    category: "Perspective",
    title: "Dashboards describe. Operations teams need triage.",
    excerpt:
      "Why adding another BI chart rarely fixes a contract or invoice backlog — and how structured pre-review triage changes the workflow.",
    body: [
      "A dashboard can tell you that average contract review time rose to 11 days last quarter. It cannot read the incoming vendor agreement on your desk today and tell you which three clauses deviate from your standard terms.",
      "Operational bottlenecks live inside unstructured documents: PDFs, MSAs, rate cards, and SOPs. Until those documents are translated into structured fields and flagged exceptions, someone on the team still has to read every page from scratch.",
      "Cadence is designed to sit before the approval queue — extracting the fields that matter, flagging the anomalies, and handing the human reviewer a clear brief.",
    ],
    readTime: "3 min read",
    date: "Field Note 03",
  },
];

export function Blog() {
  const [selected, setSelected] = React.useState<Article | null>(null);

  return (
    <section id="blog" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            align="left"
            eyebrow="Field notes"
            title="From the Cadence desk."
            description="Short operational notes on invoice triage, deterministic guardrails, and document workflows."
          />
          <a
            href="#demo"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
          >
            Try the live analyzer
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
          {articles.map((a, i) => (
            <motion.button
              key={a.title}
              type="button"
              onClick={() => setSelected(a)}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 text-left transition-colors hover:border-foreground/25"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              {/* top accent line */}
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="flex w-full items-center justify-between">
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {a.category}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {a.readTime}
                </span>
              </div>

              <h3 className="mt-4 text-base font-medium leading-snug text-foreground">
                {a.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {a.excerpt}
              </p>

              <div className="mt-5 flex w-full items-center justify-between border-t border-border pt-4">
                <span className="text-[11px] text-muted-foreground/60">
                  {a.date}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground transition-transform group-hover:translate-x-0.5">
                  Read note
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </motion.button>
          ))}
        </div>
      </div>

      <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
        <DialogContent className="max-w-lg border-border bg-background p-6">
          {selected ? (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-[11px] font-medium">
                    {selected.category}
                  </span>
                  <span>·</span>
                  <span>{selected.readTime}</span>
                </div>
                <DialogTitle className="mt-2 text-lg font-semibold text-foreground">
                  {selected.title}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {selected.excerpt}
                </DialogDescription>
              </DialogHeader>
              <div className="mt-3 space-y-3 text-sm leading-relaxed text-muted-foreground">
                {selected.body.map((para, idx) => (
                  <p key={idx}>{para}</p>
                ))}
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
