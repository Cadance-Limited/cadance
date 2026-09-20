"use client";

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { SectionHeading } from "./section-heading";

const faqs = [
  {
    q: "What can Cadence actually read?",
    a: "Invoices, vendor agreements, contracts, SOPs, and most business PDFs — pasted as text, uploaded as a URL, or pulled through an integration. The live demo accepts a URL or pasted text right now. File upload arrives with the Team plan.",
  },
  {
    q: "Does Cadence invent the numbers it cites?",
    a: "No. It reasons only from the documents and data you give it. If a fact isn't in the source, it says so and asks for it. That's the whole point — an analyst that doesn't bluff.",
  },
  {
    q: "Is my data used to train the model?",
    a: "No. Documents you analyze in the demo are processed for the response and discarded; they're not used to train anything. Team and Scale plans add data residency controls and a no-retention mode.",
  },
  {
    q: "Do I need to be technical?",
    a: "No. That's who Cadence is built for — operations and finance teams who don't want to write a rule, write a query, or read a chart. You ask a question in plain English and get a ranked set of next moves.",
  },
  {
    q: "How is this different from another dashboard?",
    a: "Dashboards describe what happened. Cadence diagnoses why it happened, where the friction lives, and what to do about it — then turns each prescription into a draft rule you can ship in one click.",
  },
  {
    q: "When does the Team plan open up?",
    a: "We're rolling out access through the waitlist. Join with your work email and we'll reach out within 48 hours. The live demo works for everyone right now — no login required.",
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
