"use client";

import { motion } from "framer-motion";
import {
  FileCheck2,
  Fingerprint,
  KeyRound,
  ShieldCheck,
  ScrollText,
  Lock,
  type LucideIcon,
} from "lucide-react";
import { SectionHeading } from "./section-heading";

type Badge = {
  icon: LucideIcon;
  label: string;
  detail: string;
};

const badges: Badge[] = [
  {
    icon: ShieldCheck,
    label: "SOC 2 Type II",
    detail: "Annual audit, controls continuously monitored.",
  },
  {
    icon: KeyRound,
    label: "SSO & SCIM",
    detail: "SAML / OIDC provisioning for your IdP.",
  },
  {
    icon: Lock,
    label: "Data encryption",
    detail: "AES-256 at rest, TLS 1.3 in transit.",
  },
  {
    icon: Fingerprint,
    label: "No model training",
    detail: "Your documents are never used to train anything.",
  },
  {
    icon: FileCheck2,
    label: "Audit log",
    detail: "Every diagnostic, exportable, retention-controlled.",
  },
  {
    icon: ScrollText,
    label: "DPA & GDPR",
    detail: "Data processing addendum available on request.",
  },
];

export function Security() {
  return (
    <section
      id="security"
      className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_40%,transparent_100%)] opacity-40" />

      <div className="mx-auto max-w-5xl px-6">
        <SectionHeading
          eyebrow={
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5" />
              Security & compliance
            </span>
          }
          title="Your operations data stays yours."
          description="Cadence is built for finance and ops teams who can't hand their contracts to just anyone. Security is the foundation, not a roadmap item."
        />

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 md:gap-5">
          {badges.map((b, i) => (
            <motion.div
              key={b.label}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.45, delay: (i % 3) * 0.06 }}
              className="card-glow group relative flex items-start gap-3.5 overflow-hidden rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/25"
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
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground">
                <b.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <div className="text-sm font-medium text-foreground">
                  {b.label}
                </div>
                <div className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {b.detail}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-8 text-center text-sm text-muted-foreground"
        >
          Need our security docs, a DPA, or a custom data-residency arrangement?{" "}
          <span className="font-medium text-foreground">
            Reach out — we reply within one business day.
          </span>
        </motion.p>
      </div>
    </section>
  );
}
