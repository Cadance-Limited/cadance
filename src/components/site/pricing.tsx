"use client";

import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "./section-heading";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Starter",
    price: "Free",
    cadence: "for individuals",
    description: "Kick the tires on the live demo. No card, no login.",
    cta: { label: "Try the demo", href: "#demo" },
    primary: false,
    features: [
      "Diagnostic chat — 50 messages / month",
      "Document analysis — 25 documents / month",
      "Invoices, contracts, SOPs",
      "Single workspace",
    ],
  },
  {
    name: "Team",
    price: "$49",
    cadence: "per seat / month",
    description: "For ops teams that live in invoices and contracts.",
    cta: { label: "Get access", href: "#cta" },
    primary: true,
    features: [
      "Unlimited diagnostic chat & analysis",
      "Up to 5 seats",
      "QuickBooks, NetSuite, DocuSign, Slack",
      "Draft rules + approval queues",
      "Anomaly alerts + weekly digest",
    ],
  },
  {
    name: "Scale",
    price: "Custom",
    cadence: "for the org",
    description: "For finance and ops orgs that need guardrails.",
    cta: { label: "Talk to us", href: "#cta" },
    primary: false,
    features: [
      "SSO + SCIM, audit log, SOC 2",
      "Custom diagnostic rules",
      "Dedicated analyst + onboarding",
      "SLA + priority model access",
      "Private deployment options",
    ],
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Pricing"
          title="Priced like an analyst, not like software per seat."
          description="Start free. Pay when Cadence is actually saving your team hours every week."
        />

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
          {tiers.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={cn(
                "card-glow group relative flex flex-col overflow-hidden rounded-2xl border bg-card p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_-28px_oklch(0_0_0/0.45)] sm:p-7",
                t.primary
                  ? "border-foreground/30 shadow-[0_24px_60px_-30px_oklch(0.985_0_0/0.25)]"
                  : "border-border hover:border-foreground/25",
              )}
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              {t.primary ? (
                <span className="absolute -top-3 left-6 inline-flex items-center gap-1.5 rounded-full border border-cadence/30 bg-cadence/10 px-2.5 py-1 text-[11px] font-medium text-cadence">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cadence" />
                  </span>
                  Most popular
                </span>
              ) : null}
              <div className="flex items-baseline justify-between">
                <h3 className="text-base font-medium text-foreground">
                  {t.name}
                </h3>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <span className="text-4xl font-semibold tracking-tight text-foreground">
                  {t.price}
                </span>
                <span className="text-sm text-muted-foreground">
                  {t.cadence}
                </span>
              </div>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {t.description}
              </p>

              <Link
                href={t.cta.href}
                className={cn(
                  "mt-6 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-all",
                  t.primary
                    ? "shimmer-border bg-foreground text-background hover:translate-y-[-1px]"
                    : "border border-border bg-secondary/40 text-foreground hover:bg-secondary",
                )}
              >
                {t.cta.label}
              </Link>

              <ul className="mt-6 flex flex-col gap-2.5 border-t border-border pt-5">
                {t.features.map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2.5 text-sm text-foreground/80"
                  >
                    <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-cadence/40 bg-cadence/10">
                      <Check className="h-2.5 w-2.5 text-cadence" />
                    </span>
                    {f}
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
