"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, RotateCcw, Share2, Sparkles } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

type Option = { label: string; score: number };
type Question = {
  id: string;
  question: string;
  options: Option[];
};

const questions: Question[] = [
  {
    id: "volume",
    question: "How many invoices does your team process per month?",
    options: [
      { label: "Under 200", score: 1 },
      { label: "200–1,000", score: 2 },
      { label: "1,000–5,000", score: 3 },
      { label: "5,000+", score: 4 },
    ],
  },
  {
    id: "review",
    question: "How long does a typical contract review take?",
    options: [
      { label: "Under 2 days", score: 1 },
      { label: "3–7 days", score: 2 },
      { label: "8–14 days", score: 3 },
      { label: "More than 2 weeks", score: 4 },
    ],
  },
  {
    id: "tooling",
    question: "How do you currently find anomalies?",
    options: [
      { label: "We don't — we find out when it's too late", score: 4 },
      { label: "Manual spot-checks", score: 3 },
      { label: "Dashboard alerts we built", score: 2 },
      { label: "Automated rules + alerts", score: 1 },
    ],
  },
];

type Result = {
  band: string;
  headline: string;
  detail: string;
  cta: string;
};

function scoreToResult(total: number): Result {
  if (total <= 4)
    return {
      band: "Optimized",
      headline: "You're running a tight ship.",
      detail:
        "Your volume and existing controls are well-balanced. Cadence can serve as a second-pass verification layer on unfamiliar vendor contracts and non-standard invoices.",
      cta: "Test the document analyzer",
    };
  if (total <= 7)
    return {
      band: "Maturing",
      headline: "You've got controls — and manual friction.",
      detail:
        "You have baseline processes in place, but manual spot-checks and multi-day reviews create queue drag. Structured field extraction and PO-matching rules can streamline your first-pass triage.",
      cta: "Try a workflow diagnostic",
    };
  if (total <= 10)
    return {
      band: "Strained",
      headline: "Manual review is becoming the bottleneck.",
      detail:
        "At this volume, reviewing every routine invoice and agreement from scratch slows down close and procurement cycles. Separating standard PO-backed items from true exceptions is the highest-leverage next move.",
      cta: "See the diagnostic demo",
    };
  return {
    band: "Critical",
    headline: "High volume with manual spot-checks creates compounding backlog.",
    detail:
      "Processing high monthly volume without automated field verification increases the risk of missed fee drift, duplicate billing, and delayed contract cycles. Start by triaging high-variance documents systematically.",
    cta: "Run a sample diagnostic",
  };
}

export function MaturityAssessment() {
  const [step, setStep] = React.useState(-1); // -1 = intro, 0..2 = questions, 3 = result
  const [answers, setAnswers] = React.useState<Record<string, number>>({});
  const { toast } = useToast();

  const select = (qid: string, score: number) => {
    setAnswers((a) => ({ ...a, [qid]: score }));
    setTimeout(() => setStep((s) => s + 1), 200);
  };

  const reset = () => {
    setAnswers({});
    setStep(-1);
  };

  const total = Object.values(answers).reduce((a, b) => a + b, 0);
  const result = step === 3 ? scoreToResult(total) : null;

  const share = () => {
    const text = `My ops maturity: ${result?.band} — ${result?.headline} (Score: ${total}/12). Take the check at Cadence.`;
    if (navigator.share) {
      navigator.share({ title: "Cadence ops maturity check", text }).catch(() => {});
    } else {
      navigator.clipboard
        ?.writeText(text)
        .then(() =>
          toast({
            title: "Copied",
            description: "Your result is on the clipboard.",
          }),
        )
        .catch(() =>
          toast({
            title: "Share unavailable",
            description: "Copy the result manually.",
            variant: "destructive",
          }),
        );
    }
  };

  return (
    <section
      id="assessment"
      className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_40%,transparent_100%)] opacity-40" />
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow={
            <span className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              Ops maturity check
            </span>
          }
          title="Where does your operations stack actually stand?"
          description="Three questions. No email required. Get a read on your stage and where structured document triage fits."
        />

        <div className="mt-10 overflow-hidden rounded-2xl border border-border bg-card">
          {/* progress bar */}
          <div className="h-1 w-full bg-secondary/40">
            <motion.div
              className="h-full bg-cadence"
              initial={{ width: "0%" }}
              animate={{
                width: step === -1 ? "0%" : `${((step + 1) / 4) * 100}%`,
              }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>

          <div className="p-6 sm:p-8" aria-live="polite">
            <AnimatePresence mode="wait">
              {step === -1 ? (
                <motion.div
                  key="intro"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.3 }}
                  className="flex flex-col items-center gap-5 text-center"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-secondary/40">
                    <Sparkles className="h-5 w-5 text-foreground" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-foreground">
                      Take the 30-second check
                    </h3>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Answer three questions about your AP volume, contract turnaround,
                      and anomaly review workflow.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(0)}
                    className="shimmer-border inline-flex h-10 items-center gap-1.5 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-all hover:translate-y-[-1px]"
                  >
                    Start
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </motion.div>
              ) : step < questions.length ? (
                <motion.div
                  key={`q-${step}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.3 }}
                >
                  <div className="mb-4 flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground/70">
                    <span className="font-mono tabular-nums">
                      {String(step + 1).padStart(2, "0")}
                    </span>
                    <span>/ 03</span>
                  </div>
                  <h3 className="text-lg font-medium text-foreground">
                    {questions[step].question}
                  </h3>
                  <div className="mt-5 grid gap-2.5">
                    {questions[step].options.map((opt) => {
                      const selected = answers[questions[step].id] === opt.score;
                      return (
                        <button
                          key={opt.label}
                          type="button"
                          onClick={() => select(questions[step].id, opt.score)}
                          className={cn(
                            "flex items-center justify-between rounded-lg border px-4 py-3 text-left text-sm transition-all",
                            selected
                              ? "border-cadence/40 bg-cadence/[0.06] text-foreground"
                              : "border-border bg-secondary/20 text-foreground/90 hover:border-foreground/30 hover:bg-secondary/40",
                          )}
                        >
                          {opt.label}
                          {selected ? (
                            <Check className="h-4 w-4 text-cadence" />
                          ) : (
                            <span className="h-4 w-4 rounded-full border border-border" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div
                  key="result"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="flex flex-col gap-4"
                >
                  <div className="flex items-center gap-3">
                    <motion.span
                      initial={{ scale: 0, rotate: -30 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-cadence/10 text-cadence"
                    >
                      <Check className="h-4 w-4" />
                    </motion.span>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full border border-cadence/30 bg-cadence/10 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-cadence">
                        {result.band}
                      </span>
                      <span className="text-xs text-muted-foreground/60">
                        Score: {total} / 12
                      </span>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold tracking-tight text-foreground">
                    {result.headline}
                  </h3>
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    {result.detail}
                  </p>
                  <div className="mt-2 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
                    <a
                      href="#demo"
                      className="shimmer-border inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-foreground px-5 text-sm font-medium text-background transition-all hover:translate-y-[-1px]"
                    >
                      {result.cta}
                      <ArrowRight className="h-3.5 w-3.5" />
                    </a>
                    <button
                      type="button"
                      onClick={share}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <Share2 className="h-3.5 w-3.5" />
                      Share
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border border-border bg-secondary/40 px-5 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      Retake
                    </button>
                  </div>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}
