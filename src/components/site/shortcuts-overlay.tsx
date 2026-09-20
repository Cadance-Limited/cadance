"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Command,
  CornerDownLeft,
  MousePointerClick,
  ArrowLeftRight,
  Moon,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

type Shortcut = {
  keys: string[];
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const groups: { heading: string; items: Shortcut[] }[] = [
  {
    heading: "Global",
    items: [
      { keys: ["⌘", "K"], label: "Open command palette", icon: Command },
      { keys: ["?"], label: "Show this shortcuts list", icon: MousePointerClick },
      { keys: ["esc"], label: "Close any dialog", icon: X },
    ],
  },
  {
    heading: "Navigate",
    items: [
      { keys: ["⌘", "K"], label: "Jump to any section", icon: Command },
      { keys: ["←", "→"], label: "Switch demo tabs", icon: ArrowLeftRight },
    ],
  },
  {
    heading: "Appearance",
    items: [{ keys: ["Theme"], label: "Toggle dark / light", icon: Moon }],
  },
];

export function ShortcutsOverlay() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // "?" (shift + /) toggles the overlay, unless typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      const typing = tag === "INPUT" || tag === "TEXTAREA";
      if (typing) return;
      if (e.shiftKey && e.key === "?") {
        // avoid conflict with command palette's ⌘K
        if (e.metaKey || e.ctrlKey) return;
        e.preventDefault();
        setOpen((o) => !o);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-md gap-0 border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle className="text-base font-semibold text-foreground">
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Cadence is fully keyboard-driven. Press{" "}
            <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px]">
              ?
            </kbd>{" "}
            anywhere to see this list.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 p-5">
          {groups.map((g) => (
            <div key={g.heading} className="flex flex-col gap-2.5">
              <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                {g.heading}
              </div>
              {g.items.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-2.5 text-sm text-foreground/90">
                    <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                    {item.label}
                  </div>
                  <div className="flex items-center gap-1">
                    {item.keys.map((k, i) => (
                      <kbd
                        key={i}
                        className="inline-flex h-5 items-center rounded border border-border bg-secondary px-1.5 font-mono text-[11px] text-muted-foreground"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
