"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import Link from "next/link";
import { SectionHeading } from "./section-heading";
import { ContactSalesModal } from "./contact-sales";
import { cn } from "@/lib/utils";

const tiers = [
  {
    name: "Preview",
    price: "Free",
    cadence: "live in browser today",
    description: "Evaluate the interactive diagnostic chat and document analyzer right now.",
    cta: { label: "Try the demo", href: "#demo" },
    primary: false,
    salesAction: false,
    features: [
      "Interactive diagnostic chat (live AI + rule engine)",
      "Document analysis via pasted text or public URL",
      "Invoices, contracts, and SOPs",
      "No login or credit card required",
    ],
  },
  {
    name: "Team (Planned)",
    price: "$49",
    cadence: "proposed per seat / month",
    description: "Planned tier for operations and finance teams joining the waitlist.",
    cta: { label: "Join waitlist", href: "#cta" },
    primary: true,
    salesAction: false,
    features: [
      "Persistent shared team workspaces (planned)",
      "Direct PDF, DOCX, and XLSX file uploads (planned)",
      "Planned QuickBooks, NetSuite, DocuSign & Slack connectors",
      "Configurable variance & approval threshold rules (planned)",
      "Early cohort onboarding via waitlist",
    ],
  },
  {
    name: "Scale (Planned)",
    price: "Custom",
    cadence: "proposed enterprise tier",
    description: "Planned tier for organizations requiring custom deployment and identity controls.",
    cta: { label: "Register interest", href: "#cta" },
    primary: false,
    salesAction: true,
    features: [
      "Planned SSO (SAML/OIDC) & SCIM provisioning",
      "Planned exportable audit logs & SOC 2 attestation",
      "Custom diagnostic playbooks & onboarding",
      "Private VPC or self-hosted deployment options",
      "Architecture scoping with the engineering team",
    ],
  },
];

export function Pricing() {
  const [salesOpen, setSalesOpen] = React.useState(false);

  return (
    <section id="pricing" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow="Planned Pricing"
          title="Try the preview free today. Planned tiers for teams."
          description="Billing and paid subscriptions are not active during the technical preview. Join the waitlist to lock in early access when Team and Scale workspaces launch."
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
                  Planned cohort
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

              {t.salesAction ? (
                <button
                  type="button"
                  onClick={() => setSalesOpen(true)}
                  className={cn(
                    "mt-6 inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-all",
                    "border border-border bg-secondary/40 text-foreground hover:bg-secondary",
                  )}
                >
                  {t.cta.label}
                </button>
              ) : (
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
              )}

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

      <ContactSalesModal open={salesOpen} onOpenChange={setSalesOpen} />
    </section>
  );
}
