"use client";

import { motion } from "framer-motion";
import {
  ReceiptText,
  Settings2,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";
import { useCountUp, useInView } from "@/hooks/use-count-up";

type Persona = {
  icon: LucideIcon;
  role: string;
  tagline: string;
  bullets: string[];
  stat: { value: number; suffix: string; decimals: number; label: string };
};

const personas: Persona[] = [
  {
    icon: ReceiptText,
    role: "Finance & AP",
    tagline: "Spot invoice discrepancies before payment release.",
    bullets: [
      "Extract vendor, dates, subtotal, tax, total, and payment terms",
      "Flag Net-30→Net-45 shifts, undeclared surcharges, and math errors",
      "Identify missing PO references that block 3-way matching",
    ],
    stat: { value: 3, suffix: "-way match", decimals: 0, label: "readiness check" },
  },
  {
    icon: Settings2,
    role: "Operations",
    tagline: "Structure messy workflow questions into clear action plans.",
    bullets: [
      "Diagnose process bottlenecks from plain-English descriptions",
      "Separate supplied evidence from operational assumptions",
      "Receive a ranked list of next moves and open questions",
    ],
    stat: { value: 3, suffix: " sections", decimals: 0, label: "reasoning, moves & question" },
  },
  {
    icon: FileSignature,
    role: "Procurement & Legal",
    tagline: "Triage vendor agreements and SOPs with structured field extraction.",
    bullets: [
      "Paste contract or SOP text or fetch from a public URL",
      "Surface renewal windows, liability clauses, and missing thresholds",
      "Give reviewers a structured summary before deep redlining",
    ],
    stat: { value: 4, suffix: " doc modes", decimals: 0, label: "Auto, Invoice, Contract, SOP" },
  },
];

export function UseCases() {
  const { ref, inView } = useInView<HTMLDivElement>({ threshold: 0.2 });

  return (
    <section id="use-cases" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Built for"
          title="Three teams. One analyst."
          description="Cadence meets your team where the work already happens — and speaks the language of the role, not the system."
        />

        <div ref={ref} className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
          {personas.map((p, i) => (
            <PersonaCard key={p.role} persona={p} index={i} inView={inView} />
          ))}
        </div>
      </div>
    </section>
  );
}

function PersonaCard({
  persona: p,
  index,
  inView,
}: {
  persona: Persona;
  index: number;
  inView: boolean;
}) {
  const value = useCountUp(p.stat.value, {
    decimals: p.stat.decimals,
    start: inView,
  });
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      className="card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25"
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
        e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
      }}
    >
      {/* top accent line */}
      <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary text-foreground">
            <p.icon className="h-4 w-4" />
          </span>
          <h3 className="text-base font-medium text-foreground">{p.role}</h3>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium text-foreground/90">{p.tagline}</p>

      {/* animated stat */}
      <div className="mt-4 flex items-baseline gap-1.5 rounded-lg border border-border bg-secondary/30 px-3 py-2.5">
        <span className="text-2xl font-semibold tracking-tight text-foreground tabular-nums">
          {value}
        </span>
        <span className="text-xs text-muted-foreground">{p.stat.suffix}</span>
        <span className="ml-auto text-xs text-muted-foreground">
          {p.stat.label}
        </span>
      </div>

      <ul className="mt-4 flex flex-col gap-2.5 border-t border-border pt-4">
        {p.bullets.map((b) => (
          <li
            key={b}
            className="flex items-start gap-2.5 text-sm leading-relaxed text-muted-foreground"
          >
            <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cadence" />
            {b}
          </li>
        ))}
      </ul>
    </motion.div>
  );
}
