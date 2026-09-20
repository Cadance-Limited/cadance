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
  const sectionRef = React.useRef<HTMLElement>(null);

  // ← / → keyboard navigation to switch tabs (only when demo section is in view)
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // Ignore if the user is typing in an input/textarea (e.g. the chat box)
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      // Only react when the demo section is roughly centered in the viewport
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.6 && rect.bottom > window.innerHeight * 0.4;
      if (!inView) return;

      if (e.key === "ArrowRight") {
        setTab((t) => (t === "chat" ? "docs" : "chat"));
      } else if (e.key === "ArrowLeft") {
        setTab((t) => (t === "docs" ? "chat" : "docs"));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <section
      ref={sectionRef}
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
        <div className="mt-10 flex flex-col items-center gap-3">
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
          {/* keyboard hint */}
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/60">
            <span>switch with</span>
            <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px]">
              ←
            </kbd>
            <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px]">
              →
            </kbd>
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
        "relative inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-foreground text-background shadow-sm"
          : "text-muted-foreground hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" />
      {label}
      {active ? (
        <motion.span
          layoutId="demo-tab-active"
          className="absolute -bottom-[5px] left-1/2 h-1 w-1 -translate-x-1/2 rounded-full bg-cadence"
          transition={{ type: "spring", stiffness: 350, damping: 30 }}
        />
      ) : null}
    </button>
  );
}
