"use client";

import Link from "next/link";
import { motion, useScroll, useTransform } from "framer-motion";
import { ArrowRight, Check, ChevronDown, FileText, Sparkles, Zap } from "lucide-react";
import { Eyebrow } from "./section-heading";
import { useWaitlistCount } from "@/hooks/use-waitlist-count";
import { cn } from "@/lib/utils";

const reasoningSteps = [
  "Parsed 1,284 AP records from Q3 · flagged 11 outliers",
  "Cross-referenced vendor SLA terms against payment dates",
  "Bottleneck located: manual 3-way match on invoices < $5k",
];

export function Hero() {
  const waitlistCount = useWaitlistCount();
  const { scrollY } = useScroll();
  // parallax: ambient layers drift up slower than the content as you scroll
  const gridY = useTransform(scrollY, [0, 600], [0, 80]);
  const glowY = useTransform(scrollY, [0, 600], [0, 50]);
  const haloY = useTransform(scrollY, [0, 600], [0, 120]);
  return (
    <section className="relative overflow-hidden pt-32 pb-20 sm:pt-40 sm:pb-28">
      {/* Ambient layers (parallax) */}
      <motion.div style={{ y: gridY }} className="pointer-events-none absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_60%,transparent_100%)]" />
      <motion.div style={{ y: glowY }} className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[520px] glow-radial" />
      <motion.div style={{ y: haloY }} className="pointer-events-none absolute left-1/2 top-24 -z-10 h-[340px] w-[680px] -translate-x-1/2 halo-conic animate-cadence-aurora opacity-70" />

      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <Eyebrow>
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cadence" />
              </span>
              Private beta · diagnostic AI for ops
            </Eyebrow>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.05 }}
            className="mt-6 text-balance text-4xl font-semibold tracking-tight text-foreground sm:text-6xl md:text-[4.25rem] md:leading-[1.02]"
          >
            Diagnose your operations.
            <br />
            <span className="bg-gradient-to-r from-foreground via-foreground/80 to-foreground/40 bg-clip-text text-transparent">
              Prescribe what&apos;s next.
            </span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            Cadence reads your invoices, contracts, and SOPs, reasons through
            the bottlenecks, and hands your team the next three moves — in
            plain English, not another dashboard.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.18 }}
            className="mt-9 flex flex-col items-center gap-3 sm:flex-row"
          >
            <Link
              href="#demo"
              className="shimmer-border group inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-foreground px-6 text-sm font-medium text-background transition-all hover:translate-y-[-1px] hover:shadow-[0_12px_40px_-12px_oklch(0.985_0_0/0.4)]"
            >
              Try the live demo
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <Link
              href="#how"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-border bg-background/40 px-6 text-sm font-medium text-foreground backdrop-blur transition-colors hover:bg-secondary"
            >
              <Sparkles className="h-4 w-4 text-muted-foreground" />
              How it works
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.28 }}
            className="mt-4 text-xs text-muted-foreground/70"
          >
            No login. No setup. No credit card.
          </motion.p>

          {/* social proof */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.36 }}
            className="mt-7 flex items-center justify-center gap-3"
          >
            <div className="flex -space-x-2">
              {[
                "from-emerald-400/30 to-emerald-600/20",
                "from-zinc-400/30 to-zinc-600/20",
                "from-amber-400/30 to-amber-600/20",
                "from-rose-400/30 to-rose-600/20",
                "from-cyan-400/30 to-cyan-600/20",
              ].map((g, i) => (
                <span
                  key={i}
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br text-[10px] font-semibold text-foreground/70",
                    g,
                  )}
                >
                  {["MV", "JK", "AR", "TL", "SP"][i]}
                </span>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">
              <span className="font-semibold text-foreground tabular-nums">
                {waitlistCount.toLocaleString()}+
              </span>{" "}
              operators on the waitlist
            </p>
          </motion.div>
        </div>

        {/* Hero mockup — diagnostic panel */}
        <motion.div
          initial={{ opacity: 0, y: 28, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.25, ease: [0.22, 1, 0.36, 1] }}
          className="relative mx-auto mt-16 max-w-4xl"
        >
          <div className="absolute -inset-x-8 -top-6 -bottom-6 -z-10 rounded-[2rem] bg-gradient-to-b from-foreground/[0.06] to-transparent blur-2xl" />
          <HeroPanel />
        </motion.div>

        {/* scroll-to-explore indicator */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.9 }}
          className="mt-14 flex flex-col items-center gap-2"
        >
          <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground/50">
            Scroll to explore
          </span>
          <motion.div
            animate={{ y: [0, 6, 0] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
            className="flex h-8 w-5 items-start justify-center rounded-full border border-border pt-1.5"
          >
            <motion.span className="h-1.5 w-1 rounded-full bg-muted-foreground/60" />
          </motion.div>
          <ChevronDown className="-mt-1 h-3.5 w-3.5 text-muted-foreground/40" />
        </motion.div>
      </div>
    </section>
  );
}

function HeroPanel() {
  return (
    <div className="noise-overlay overflow-hidden rounded-2xl border border-border bg-card/80 shadow-[0_2px_0_0_oklch(0.5_0_0/0.05),0_24px_60px_-20px_oklch(0_0_0/0.5)] backdrop-blur-xl">
      {/* window chrome */}
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
          <span className="h-2.5 w-2.5 rounded-full bg-foreground/15" />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
            <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cadence" />
          </span>
          cadence · diagnostic session
        </div>
        <div className="text-[11px] text-muted-foreground/60">live</div>
      </div>

      <div className="grid gap-px bg-border sm:grid-cols-[1.1fr_1fr]">
        {/* Left — question + reasoning */}
        <div className="flex flex-col gap-5 bg-card p-5">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <FileText className="h-3.5 w-3.5" />
              Question
            </div>
            <p className="text-sm leading-relaxed text-foreground">
              Why did our AP cycle time jump 40% in Q3 — and what should we
              fix first?
            </p>
          </div>

          <div className="h-px bg-border" />

          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              <Zap className="h-3.5 w-3.5" />
              Diagnostic reasoning
            </div>
            <ol className="flex flex-col gap-2.5">
              {reasoningSteps.map((step, i) => (
                <li
                  key={i}
                  className="animate-cadence-rise flex items-start gap-2.5 text-sm text-muted-foreground"
                  style={{ animationDelay: `${0.5 + i * 0.18}s` }}
                >
                  <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-cadence/40 bg-cadence/10">
                    <Check className="h-2.5 w-2.5 text-cadence" />
                  </span>
                  <span className="text-foreground/80">{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Right — prescription */}
        <div className="flex flex-col gap-4 bg-secondary/30 p-5">
          <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-cadence">
            <Sparkles className="h-3.5 w-3.5" />
            Prescription
          </div>
          <div className="rounded-lg border border-border bg-card p-4">
            <p className="text-sm font-medium text-foreground">
              Auto-approve invoices under $5k
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Bypass manual 3-way match for low-risk invoices. Route
              exceptions to a single reviewer queue.
            </p>
            <div className="mt-3 flex items-baseline gap-1.5">
              <span className="text-2xl font-semibold tracking-tight text-foreground">
                6.2
              </span>
              <span className="text-xs text-muted-foreground">hrs / week recovered</span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            {[
              "Draft the exception rule",
              "Notify approvers in #ops-finance",
              "Schedule 14-day review",
            ].map((t, i) => (
              <div
                key={i}
                className={cn(
                  "flex items-center gap-2 rounded-md border border-border bg-card/60 px-3 py-2 text-xs text-muted-foreground",
                )}
              >
                <span className="flex h-4 w-4 items-center justify-center rounded border border-border text-[9px] font-medium text-muted-foreground">
                  {i + 1}
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
