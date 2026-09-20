"use client";

import { motion } from "framer-motion";
import { ArrowUpRight, Clock } from "lucide-react";
import { SectionHeading } from "./section-heading";

type Article = {
  category: string;
  title: string;
  excerpt: string;
  readTime: string;
  date: string;
};

const articles: Article[] = [
  {
    category: "Field notes",
    title: "The 3-way match is the most expensive cheap process in AP",
    excerpt:
      "Why the manual 3-way match survives at almost every mid-market company — and the one rule change that recovers 6 hours a week.",
    readTime: "6 min read",
    date: "Sep 2025",
  },
  {
    category: "How-to",
    title: "From NetSuite export to prescription in 4 minutes",
    excerpt:
      "A walkthrough of connecting a NetSuite export, letting Cadence diagnose the cycle-time spike, and shipping the first draft rule.",
    readTime: "8 min read",
    date: "Aug 2025",
  },
  {
    category: "Perspective",
    title: "Dashboards describe. That's the ceiling, not the floor.",
    excerpt:
      "The case for an analyst that does the thinking after the chart — and why 'just one more dashboard' is the wrong reflex.",
    readTime: "5 min read",
    date: "Aug 2025",
  },
];

export function Blog() {
  return (
    <section id="blog" className="relative scroll-mt-20 py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-end">
          <SectionHeading
            align="left"
            eyebrow="Field notes"
            title="From the Cadence desk."
            description="Sharp takes and walkthroughs for operations, finance, and procurement teams. No fluff."
          />
          <a
            href="#blog"
            className="inline-flex shrink-0 items-center gap-1.5 text-sm font-medium text-foreground transition-colors hover:text-foreground/80"
          >
            All posts
            <ArrowUpRight className="h-3.5 w-3.5" />
          </a>
        </div>

        <div className="mt-12 grid gap-4 md:grid-cols-3 md:gap-5">
          {articles.map((a, i) => (
            <motion.a
              key={a.title}
              href="#blog"
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="card-glow group relative flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-6 transition-colors hover:border-foreground/25"
              onMouseMove={(e) => {
                const r = e.currentTarget.getBoundingClientRect();
                e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`);
                e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`);
              }}
            >
              {/* top accent line */}
              <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-foreground/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

              <div className="flex items-center justify-between">
                <span className="rounded-full border border-border bg-secondary/40 px-2.5 py-0.5 text-[11px] font-medium text-muted-foreground">
                  {a.category}
                </span>
                <span className="flex items-center gap-1 text-[11px] text-muted-foreground/60">
                  <Clock className="h-3 w-3" />
                  {a.readTime}
                </span>
              </div>

              <h3 className="mt-4 text-base font-medium leading-snug text-foreground">
                {a.title}
              </h3>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">
                {a.excerpt}
              </p>

              <div className="mt-5 flex items-center justify-between border-t border-border pt-4">
                <span className="text-[11px] text-muted-foreground/60">
                  {a.date}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-medium text-foreground transition-transform group-hover:translate-x-0.5">
                  Read
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </motion.a>
          ))}
        </div>
      </div>
    </section>
  );
}
