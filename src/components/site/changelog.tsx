"use client";

import * as React from "react";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  Sparkles,
  Shield,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Change = {
  icon: LucideIcon;
  tag: string;
  title: string;
  detail: string;
  date: string;
};

const changes: Change[] = [
  {
    icon: Shield,
    tag: "Security",
    title: "SSRF-guarded URL ingestion & CSP hardening",
    detail:
      "URL analysis now validates DNS resolution, blocks private/loopback/metadata IP ranges, verifies redirects hop-by-hop, and enforces strict Content-Security-Policy and HSTS headers.",
    date: "v1.0",
  },
  {
    icon: Sparkles,
    tag: "Reliability",
    title: "Non-hallucinating deterministic fallback engine",
    detail:
      "Both diagnostic chat and document intelligence now explicitly badge Live AI vs. Deterministic Rule Engine mode, verify invoice subtotal/tax arithmetic, and never invent unverified metrics.",
    date: "v1.0",
  },
  {
    icon: Zap,
    tag: "Architecture",
    title: "Database migration integrity & structured logging",
    detail:
      "Added versioned Prisma SQL migrations, honest HTTP 503 error reporting when storage is unreachable, and correlation-ID server logs with automatic PII redaction.",
    date: "v1.0",
  },
];

/** Context so the nav badge can trigger the modal without prop drilling. */
const ChangelogContext = React.createContext<{
  open: () => void;
} | null>(null);

export function useChangelog() {
  return React.useContext(ChangelogContext);
}

export function ChangelogProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const ctx = React.useMemo(() => ({ open: () => setOpen(true) }), []);
  return (
    <ChangelogContext.Provider value={ctx}>
      {children}
      <ChangelogModal open={open} onOpenChange={setOpen} />
    </ChangelogContext.Provider>
  );
}

function ChangelogModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-cadence" />
            </span>
            What&apos;s new in Cadence
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Engineering release notes reflecting verified improvements in this repository.</span>
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-px bg-border">
          {changes.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.3, delay: i * 0.08 }}
              className="flex items-start gap-4 bg-background p-5"
            >
              <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-secondary text-foreground">
                <c.icon className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-cadence/30 bg-cadence/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-cadence">
                    {c.tag}
                  </span>
                  <span className="text-[11px] text-muted-foreground/60">
                    {c.date}
                  </span>
                </div>
                <h3 className="mt-1.5 text-sm font-medium text-foreground">
                  {c.title}
                </h3>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {c.detail}
                </p>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="border-t border-border px-6 py-4">
          <a
            href="#demo"
            onClick={() => onOpenChange(false)}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
          >
            Try the hardened live demo
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
