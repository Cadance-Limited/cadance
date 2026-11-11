"use client";

import * as React from "react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";
import { Glossary } from "./glossary";

const faqs: { q: string; a: React.ReactNode }[] = [
  {
    q: "What can Cadence read right now?",
    a: (
      <>
        In this preview, you can paste text from invoices, vendor agreements, contracts, or <Glossary term="SOP">SOPs</Glossary>, or provide a public HTTP/HTTPS webpage URL. Direct binary file uploads (PDF, DOCX, XLSX) and native ERP connectors are planned for the upcoming Team release.
      </>
    ),
  },
  {
    q: "Does Cadence invent numbers or savings estimates?",
    a: "No. Cadence is engineered to separate supplied facts from assumptions. If a number isn't in the text you provide, it won't fabricate hours recovered, historical baselines, or benchmark percentages — and it clearly badges whether an answer came from the live AI model or the deterministic rule engine.",
  },
  {
    q: "How are submitted documents handled in the preview?",
    a: "Documents analyzed in the live demo are processed transiently in memory to generate the response and are not stored in the application database. Server logs automatically redact document text and email addresses. However, because this is a public preview, do not submit confidential production secrets or regulated PII.",
  },
  {
    q: "What happens if the external AI provider is offline or unconfigured?",
    a: "Cadence automatically falls back to its built-in deterministic diagnostic and document extraction engine, and displays a visible mode badge so you always know which engine produced the output.",
  },
  {
    q: "How is this different from a traditional BI dashboard?",
    a: (
      <>
        Dashboards aggregate structured database rows into charts. Cadence inspects unstructured operational text — such as invoices and contracts — to check arithmetic, flag <Glossary term="anomaly">anomalies</Glossary> like Net-terms drift or missing POs, and outline the next verification steps.
      </>
    ),
  },
  {
    q: "How do the waitlist and planned pricing tiers work?",
    a: "The interactive demo is free to use in your browser with no login. Joining the waitlist records your email in our database so we can notify you when persistent Team workspaces and enterprise Scale deployments open.",
  },
];

export function FAQ() {
  return (
    <section id="faq" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-3xl px-6">
        <SectionHeading
          eyebrow="FAQ"
          title="The questions ops teams actually ask."
        />
        <Accordion type="single" collapsible className="mt-10">
          {faqs.map((f, i) => (
            <AccordionItem
              key={i}
              value={`item-${i}`}
              className="group border-b border-border transition-colors data-[state=open]:border-foreground/20"
            >
              <AccordionTrigger className="py-5 text-left text-base font-medium text-foreground transition-colors hover:no-underline hover:text-foreground/90 data-[state=open]:text-foreground">
                <span className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted-foreground/40 tabular-nums">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {f.q}
                </span>
              </AccordionTrigger>
              <AccordionContent className="pb-5 pl-8 text-sm leading-relaxed text-muted-foreground">
                {f.a}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  );
}
