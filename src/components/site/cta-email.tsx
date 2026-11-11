"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useWaitlistCount } from "@/hooks/use-waitlist-count";
import { notifyWaitlistUpdated } from "@/lib/prompt-bus";

export function CTAEmail() {
  const [email, setEmail] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [status, setStatus] = React.useState<
    "idle" | "loading" | "done" | "error"
  >("idle");
  const { toast } = useToast();
  const waitlistCount = useWaitlistCount();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company: company.trim() || undefined,
          source: "cta",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Try again");
      setStatus("done");
      notifyWaitlistUpdated();
      toast({
        title: "You're on the list",
        description: data.message || "We'll reach out when the next cohort opens.",
      });
    } catch (err) {
      setStatus("error");
      toast({
        title: "Couldn't capture that email",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <section id="cta" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-5xl px-6">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="noise-overlay relative overflow-hidden rounded-3xl border border-border bg-card p-8 sm:p-14"
        >
          {/* ambient glow */}
          <div className="pointer-events-none absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_60%_at_50%_0%,#000_50%,transparent_100%)] opacity-60" />
          <div className="pointer-events-none absolute left-1/2 top-0 -z-10 h-64 w-[640px] -translate-x-1/2 halo-conic animate-cadence-aurora opacity-60" />

          <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-secondary/40 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cadence" />
              </span>
              Technical preview — waitlist open
            </span>
            <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
              {waitlistCount !== null && waitlistCount > 0 ? (
                <>
                  <span className="font-semibold tabular-nums text-foreground">
                    {waitlistCount.toLocaleString()}
                  </span>
                  {waitlistCount === 1
                    ? "operator registered in database"
                    : "operators registered in database"}
                </>
              ) : (
                <span>Be among the first teams to join the early access cohort</span>
              )}
            </div>
            <h2 className="mt-5 text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-5xl sm:leading-[1.05]">
              Diagnose your operations.
              <br />
              <span className="text-muted-foreground">
                Prescribe what&apos;s next.
              </span>
            </h2>
            <p className="mt-4 max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
              Join the waitlist with your work email to be notified when persistent
              team workspaces open — no credit card required.
            </p>

            {status === "done" ? (
              <div
                role="status"
                aria-live="polite"
                className="mt-8 flex items-center gap-2.5 rounded-xl border border-cadence/30 bg-cadence/[0.06] px-5 py-3 text-sm text-foreground"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cadence text-cadence-foreground">
                  <Check className="h-3 w-3" />
                </span>
                You&apos;re on the list. Your registration has been saved.
              </div>
            ) : (
              <form
                onSubmit={submit}
                className="mt-8 flex w-full max-w-md flex-col gap-2.5 sm:flex-row"
              >
                <input
                  type="email"
                  required
                  aria-label="Work email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-11 flex-1 rounded-xl border border-border bg-background/40 px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                />
                <input
                  type="text"
                  aria-label="Company name (optional)"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company (optional)"
                  className="h-11 flex-1 rounded-xl border border-border bg-background/40 px-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="shimmer-border inline-flex h-11 items-center justify-center gap-1.5 rounded-xl bg-foreground px-5 text-sm font-medium text-background transition-all hover:translate-y-[-1px] disabled:opacity-60"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Get access
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            )}

            <p className="mt-4 text-xs text-muted-foreground/60">
              By joining, you agree to receive release updates from Cadence.
              Unsubscribe anytime.
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
