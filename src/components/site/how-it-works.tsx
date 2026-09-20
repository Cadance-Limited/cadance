"use client";

import { motion } from "framer-motion";
import { Upload, BrainCircuit, ClipboardCheck } from "lucide-react";
import { SectionHeading } from "./section-heading";

const steps = [
  {
    icon: Upload,
    title: "Bring your documents",
    body: "Connect an integration or paste a URL, contract, or SOP. Cadence ingests invoices, vendor PDFs, and process docs in seconds — no schema, no setup.",
    meta: "Step 01",
  },
  {
    icon: BrainCircuit,
    title: "Cadence reasons through it",
    body: "It doesn't just summarize. It traces the chain: what it parsed, which rules fired, where the friction lives, and what each anomaly is likely costing you.",
    meta: "Step 02",
  },
  {
    icon: ClipboardCheck,
    title: "You ship the prescription",
    body: "Get a ranked set of next moves — each with the estimated hours recovered and the owner who should pick it up. One click turns a move into a draft rule.",
    meta: "Step 03",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_50%_at_50%_50%,#000_50%,transparent_100%)] opacity-50" />
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="How it works"
          title="From document to decision in three moves."
          description="No data engineering, no implementation project. Cadence meets your team where the work already happens."
        />

        <div className="relative mt-14 grid gap-6 md:grid-cols-3 md:gap-5">
          {/* connector line */}
          <div className="pointer-events-none absolute left-0 right-0 top-[2.75rem] hidden h-px bg-gradient-to-r from-transparent via-border to-transparent md:block" />
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className="relative flex flex-col items-start"
            >
              <div className="relative z-10 mb-5 flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-card">
                <s.icon className="h-5 w-5 text-foreground" />
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-foreground text-[9px] font-semibold text-background">
                  {i + 1}
                </span>
              </div>
              <div className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/70">
                {s.meta}
              </div>
              <h3 className="mt-2 text-lg font-medium text-foreground">
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
