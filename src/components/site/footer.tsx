"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Check, Loader2, Mail } from "lucide-react";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { GlossaryTrigger } from "./glossary-trigger";
import { useToast } from "@/hooks/use-toast";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Live demo", href: "#demo" },
      { label: "Integrations", href: "#integrations" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Security", href: "#security" },
      { label: "Contact", href: "#cta" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Field notes", href: "#blog" },
      { label: "Docs", href: "#" },
      { label: "Status", href: "#" },
      { label: "API", href: "#" },
    ],
  },
];

export function Footer() {
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done">("idle");
  const { toast } = useToast();

  async function subscribe(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), source: "footer-newsletter" }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Try again");
      setStatus("done");
      setEmail("");
      toast({
        title: "Subscribed",
        description: "You'll get the next field note. Unsubscribe anytime.",
      });
    } catch (err) {
      setStatus("idle");
      toast({
        title: "Couldn't subscribe",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo wordmarkClassName="bg-gradient-to-r from-foreground via-foreground/70 to-foreground/30 bg-clip-text text-transparent" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI operations analyst. Diagnose your operations, prescribe
              what&apos;s next.
            </p>
            <ThemeToggle />
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground/50">
              <span className="flex items-center gap-1">
                Press{" "}
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px] text-muted-foreground">
                  ⌘K
                </kbd>
              </span>
              <span className="flex items-center gap-1">
                or{" "}
                <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px] text-muted-foreground">
                  ?
                </kbd>
                for shortcuts
              </span>
              <span className="text-muted-foreground/30">·</span>
              <GlossaryTrigger />
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                {col.title}
              </h3>
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        {/* newsletter strip */}
        <div className="mt-10 rounded-xl border border-border bg-secondary/20 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground">
                <Mail className="h-4 w-4" />
              </span>
              <div>
                <div className="text-sm font-medium text-foreground">
                  The Cadence field note
                </div>
                <div className="text-xs text-muted-foreground">
                  One sharp operations take, every other week. No fluff.
                </div>
              </div>
            </div>
            {status === "done" ? (
              <div className="flex items-center gap-2 rounded-lg border border-cadence/30 bg-cadence/[0.06] px-4 py-2.5 text-sm text-foreground">
                <Check className="h-4 w-4 text-cadence" />
                You&apos;re subscribed.
              </div>
            ) : (
              <form onSubmit={subscribe} className="flex w-full max-w-sm items-center gap-2">
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="h-10 flex-1 rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-all hover:translate-y-[-1px] disabled:opacity-60"
                >
                  {status === "loading" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      Subscribe
                      <ArrowRight className="h-3.5 w-3.5" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Cadence Labs. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
            <Link href="#" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              SOC 2
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
