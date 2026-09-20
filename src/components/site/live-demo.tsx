"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { BrainCircuit, FileSearch } from "lucide-react";
import { SectionHeading } from "./section-heading";
import { DemoChat } from "./demo-chat";
import { DemoDocs } from "./demo-docs";
import { cn } from "@/lib/utils";

type Tab = "chat" | "docs";

export function LiveDemo() {
  const [tab, setTab] = React.useState<Tab>("chat");

  return (
    <section
      id="demo"
      className="relative scroll-mt-20 overflow-hidden py-24 sm:py-32"
    >
      {/* ambient backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10 bg-grid [mask-image:radial-gradient(ellipse_70%_60%_at_50%_40%,#000_45%,transparent_100%)] opacity-60" />
      <div className="pointer-events-none absolute left-1/2 top-1/3 -z-10 h-[420px] w-[760px] -translate-x-1/2 halo-conic opacity-50" />

      <div className="mx-auto max-w-6xl px-6">
        <SectionHeading
          eyebrow={
            <span className="flex items-center gap-2">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-cadence" />
              </span>
              Live demo · no login
            </span>
          }
          title="Ask Cadence. Watch it reason."
          description="Two working demos, wired to a real model. The chat diagnoses from what you tell it; the document reader extracts fields, flags anomalies, and prescribes next moves."
        />

        {/* tabs */}
        <div className="mt-10 flex justify-center">
          <div className="inline-flex rounded-xl border border-border bg-card p-1">
            <TabButton
              active={tab === "chat"}
              onClick={() => setTab("chat")}
              icon={BrainCircuit}
              label="Diagnostic chat"
            />
            <TabButton
              active={tab === "docs"}
              onClick={() => setTab("docs")}
              icon={FileSearch}
              label="Document intelligence"
            />
          </div>
        </div>

        {/* panel */}
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8"
        >
          {tab === "chat" ? <DemoChat /> : <DemoDocs />}
        </motion.div>
      </div>
    </section>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
    </button>
  );
}
