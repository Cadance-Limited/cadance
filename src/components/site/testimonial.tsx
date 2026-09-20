"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, Quote } from "lucide-react";
import { cn } from "@/lib/utils";

type Testimonial = {
  quote: string;
  name: string;
  initials: string;
  role: string;
  company: string;
};

const testimonials: Testimonial[] = [
  {
    quote:
      "We stopped buying another dashboard. Cadence reads the invoices, tells us which three are wrong, and what to do about it. The ops team saved a full role's worth of time in the first month.",
    name: "Maya Vance",
    initials: "MV",
    role: "VP Operations",
    company: "Northwind Trading",
  },
  {
    quote:
      "Cadence found a Net-30→Net-45 term drift across 11 vendors in our first week. That single catch paid for the tool for the year. It reasons like a senior analyst, not a chatbot.",
    name: "James Kim",
    initials: "JK",
    role: "Director of Finance",
    company: "Helix Logistics",
  },
  {
    quote:
      "Our contract review went from 11 days to 2. Cadence reads the vendor agreement, flags the risky clauses, and hands legal a redline-ready summary. The reasoning trace is the trust layer.",
    name: "Aria Rao",
    initials: "AR",
    role: "Head of Procurement",
    company: "Aurora Mfg.",
  },
];

export function TestimonialCarousel() {
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const go = React.useCallback(
    (dir: number) =>
      setIndex((i) => (i + dir + testimonials.length) % testimonials.length),
    [],
  );

  // auto-advance every 7s, paused on hover
  React.useEffect(() => {
    if (paused) return;
    const t = setInterval(() => {
      setIndex((i) => (i + 1) % testimonials.length);
    }, 7000);
    return () => clearInterval(t);
  }, [paused]);

  const active = testimonials[index];

  return (
    <section
      className="relative py-24 sm:py-32"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="mx-auto max-w-4xl px-6">
        <div className="noise-overlay relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-foreground/[0.04] blur-3xl" />
          <Quote className="h-7 w-7 text-muted-foreground/40" />

          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            >
              <blockquote className="mt-5 text-balance text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl md:text-[1.625rem]">
                &ldquo;{active.quote}&rdquo;
              </blockquote>
              <div className="mt-6 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-foreground">
                  {active.initials}
                </div>
                <div>
                  <div className="text-sm font-medium text-foreground">
                    {active.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {active.role}, {active.company}
                  </div>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>

          {/* controls */}
          <div className="mt-8 flex items-center justify-between border-t border-border pt-5">
            <div className="flex items-center gap-2">
              {testimonials.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setIndex(i)}
                  aria-label={`Go to testimonial ${i + 1}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === index
                      ? "w-6 bg-foreground"
                      : "w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/50",
                  )}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => go(-1)}
                aria-label="Previous testimonial"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => go(1)}
                aria-label="Next testimonial"
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <ArrowRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
