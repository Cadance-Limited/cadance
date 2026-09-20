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
    tagline: "Close the books faster, with fewer surprises.",
    bullets: [
      "Auto-extract vendor, total, and terms from every invoice",
      "Flag Net-30→Net-45 drift and duplicate line items",
      "Get a ranked queue of which approvals to remove",
    ],
    stat: { value: 6.2, suffix: " hrs", decimals: 1, label: "saved per week" },
  },
  {
    icon: Settings2,
    role: "Operations",
    tagline: "Find the bottleneck before the quarter finds you.",
    bullets: [
      "Diagnose cycle-time spikes from your process data",
      "Turn each friction point into a draft workflow rule",
      "Watch the hours-recovered estimate update per move",
    ],
    stat: { value: 73, suffix: "%", decimals: 0, label: "faster cycle time" },
  },
  {
    icon: FileSignature,
    role: "Procurement & Legal",
    tagline: "Review contracts in hours, not eleven days.",
    bullets: [
      "Drop in a vendor agreement — get the risky clauses called out",
      "Compare terms against your templates automatically",
      "Ship a redline-ready summary to the approver queue",
    ],
    stat: { value: 11, suffix: "→2 days", decimals: 0, label: "review time" },
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
