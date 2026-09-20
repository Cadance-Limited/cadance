import { Quote } from "lucide-react";

export function Testimonial() {
  return (
    <section className="relative py-24 sm:py-32">
      <div className="mx-auto max-w-4xl px-6">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 sm:p-12">
          <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-foreground/[0.04] blur-3xl" />
          <Quote className="h-7 w-7 text-muted-foreground/40" />
          <blockquote className="mt-5 text-balance text-xl font-medium leading-snug tracking-tight text-foreground sm:text-2xl md:text-[1.625rem]">
            “We stopped buying another dashboard. Cadence reads the invoices,
            tells us which three are wrong, and what to do about it. The ops
            team saved a full role&apos;s worth of time in the first month.”
          </blockquote>
          <div className="mt-6 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-secondary text-sm font-semibold text-foreground">
              MV
            </div>
            <div>
              <div className="text-sm font-medium text-foreground">
                Maya Vance
              </div>
              <div className="text-xs text-muted-foreground">
                VP Operations, Northwind Trading
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
