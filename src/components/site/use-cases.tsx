"use client";

import { motion } from "framer-motion";
import {
  ReceiptText,
  Settings2,
  FileSignature,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";

type Persona = {
  icon: LucideIcon;
  role: string;
  tagline: string;
  bullets: string[];
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
  },
];

export function UseCases() {
  return (
    <section id="use-cases" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Built for"
          title="Three teams. One analyst."
          description="Cadence meets your team where the work already happens — and speaks the language of the role, not the system."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
          {personas.map((p, i) => (
            <motion.div
              key={p.role}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25"
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
              {/* top accent line */}
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-secondary text-foreground">
                  <p.icon className="h-4 w-4" />
                </span>
                <h3 className="text-base font-medium text-foreground">
                  {p.role}
                </h3>
              </div>
              <p className="mt-3 text-sm font-medium text-foreground/90">
                {p.tagline}
              </p>
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
          ))}
        </div>
      </div>
    </section>
  );
}
