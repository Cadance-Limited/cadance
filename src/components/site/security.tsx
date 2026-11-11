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

/**
 * Factual description of implemented application-layer security controls
 * and clearly labeled enterprise roadmap items. Never claims unverified certifications.
 */
const badges: Badge[] = [
  {
    icon: ShieldCheck,
    label: "SSRF-Guarded URL Fetcher",
    detail:
      "Validates HTTP/S schemes, resolves DNS records, blocks private/loopback/metadata IPs, and validates redirects hop-by-hop.",
  },
  {
    icon: Lock,
    label: "CSP & HSTS Headers",
    detail:
      "Enforces Content-Security-Policy, Strict-Transport-Security, X-Frame-Options: DENY, and nosniff headers.",
  },
  {
    icon: Fingerprint,
    label: "Prompt-Injection Isolation",
    detail:
      "Wraps untrusted document text in isolated XML boundaries and strips control sequences before analysis.",
  },
  {
    icon: FileCheck2,
    label: "Strict Output Validation",
    detail:
      "Normalizes and bounds all model responses and enforces payload size caps (64 KB) on every API route.",
  },
  {
    icon: ScrollText,
    label: "Redacted Structured Logs",
    detail:
      "Server logs track request correlation IDs and latency while redacting raw document text, emails, and credentials.",
  },
  {
    icon: KeyRound,
    label: "Roadmap: SSO, SCIM & SOC 2",
    detail:
      "SAML/OIDC authentication, tenant-isolated storage, and formal third-party SOC 2 audits are planned for enterprise release.",
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
              Security architecture &amp; roadmap
            </span>
          }
          title="Verifiable application controls today. Enterprise compliance on the roadmap."
          description="This technical preview implements strict input validation, SSRF-protected URL fetching, rate limiting, and PII-redacted logging. Do not submit sensitive regulated production secrets to the public demo."
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
          Evaluating Cadence for a private or self-hosted deployment?{" "}
          <a
            href="#cta"
            className="font-medium text-foreground underline-offset-2 hover:underline"
          >
            Join the waitlist to discuss security requirements.
          </a>
        </motion.p>
      </div>
    </section>
  );
}
