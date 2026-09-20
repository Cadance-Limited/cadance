"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BookOpen, Search } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Term = { term: string; definition: string };

const TERMS: Term[] = [
  {
    term: "3-way match",
    definition:
      "Verifying an invoice against both the purchase order and the receiving receipt before paying. A core AP control — and a common bottleneck when done manually on every invoice.",
  },
  {
    term: "Net terms",
    definition:
      "The number of days a buyer has to pay an invoice after it's issued. Net 30 = pay within 30 days. Longer terms (e.g. Net 45) improve the buyer's cash flow but cost the vendor.",
  },
  {
    term: "Anomaly",
    definition:
      "A value that deviates significantly from the norm — an outlier price, a duplicate line item, terms that drift from your template. Cadence surfaces these before you have to look for them.",
  },
  {
    term: "AP (Accounts Payable)",
    definition:
      "The money a company owes its vendors for goods or services purchased on credit. The AP team processes and pays invoices.",
  },
  {
    term: "SLA (Service Level Agreement)",
    definition:
      "A vendor's commitment to a performance standard (e.g. response time, uptime). Cadence cross-references SLAs against actual payment and delivery dates.",
  },
  {
    term: "SOP (Standard Operating Procedure)",
    definition:
      "The documented steps for a recurring process. Cadence reads SOPs to understand how your team actually works.",
  },
];

export function GlossaryIndex({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [query, setQuery] = React.useState("");

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return TERMS;
    return TERMS.filter(
      (t) =>
        t.term.toLowerCase().includes(q) ||
        t.definition.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg gap-0 border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <BookOpen className="h-4 w-4 text-cadence" />
            Glossary
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Plain-English definitions for the ops and finance terms Cadence
            uses. Hover any underlined term on the page, or browse them all
            here.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border p-4">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary/30 px-3">
            <Search className="h-3.5 w-3.5 text-muted-foreground/60" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search terms…"
              className="h-9 flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </div>
        </div>

        <div className="scrollbar-cadence max-h-[320px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              No terms match &ldquo;{query}&rdquo;.
            </div>
          ) : (
            filtered.map((t, i) => (
              <motion.div
                key={t.term}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: i * 0.03 }}
                className="border-b border-border px-4 py-3 last:border-b-0"
              >
                <div className="text-sm font-medium text-foreground">
                  {t.term}
                </div>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {t.definition}
                </p>
              </motion.div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
