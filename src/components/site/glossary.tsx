"use client";

import * as React from "react";
import { BookOpen, Info } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

/**
 * Inline glossary term. Renders as a dashed-underlined word that
 * opens a popover with a plain-English definition. Designed for
 * non-technical business readers encountering ops/finance jargon.
 */
const GLOSSARY: Record<string, { term: string; definition: string }> = {
  "3-way match": {
    term: "3-way match",
    definition:
      "Verifying an invoice against both the purchase order and the receiving receipt before paying. A core AP control — and a common bottleneck when done manually on every invoice.",
  },
  "net terms": {
    term: "Net terms",
    definition:
      "The number of days a buyer has to pay an invoice after it's issued. Net 30 = pay within 30 days. Longer terms (e.g. Net 45) improve the buyer's cash flow but cost the vendor.",
  },
  "anomaly": {
    term: "Anomaly",
    definition:
      "A value that deviates significantly from the norm — an outlier price, a duplicate line item, terms that drift from your template. Cadence surfaces these before you have to look for them.",
  },
  "AP": {
    term: "AP",
    definition:
      "Accounts Payable — the money a company owes its vendors for goods or services purchased on credit. The AP team processes and pays invoices.",
  },
  "SLA": {
    term: "SLA",
    definition:
      "Service Level Agreement — a vendor's commitment to a performance standard (e.g. response time, uptime). Cadence cross-references SLAs against actual payment and delivery dates.",
  },
  "SOP": {
    term: "SOP",
    definition:
      "Standard Operating Procedure — the documented steps for a recurring process. Cadence reads SOPs to understand how your team actually works.",
  },
};

export function Glossary({
  children,
  term,
}: {
  children: React.ReactNode;
  term: string;
}) {
  const entry = GLOSSARY[term.toLowerCase()] ?? { term, definition: "Definition coming soon." };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex cursor-help items-center gap-0.5 border-b border-dashed border-muted-foreground/40 text-foreground underline-offset-2 transition-colors hover:border-foreground hover:text-foreground"
        >
          {children ?? entry.term}
          <Info className="h-3 w-3 text-muted-foreground/50" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="center"
        sideOffset={8}
        className="w-72 rounded-xl border border-border bg-popover p-0 text-popover-foreground shadow-xl"
      >
        <div className="border-b border-border px-3 py-2">
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <BookOpen className="h-3 w-3" />
            Glossary
          </div>
        </div>
        <div className="px-3 py-2.5">
          <div className="text-sm font-medium text-foreground">
            {entry.term}
          </div>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            {entry.definition}
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
