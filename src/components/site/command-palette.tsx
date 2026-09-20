"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  BrainCircuit,
  FileSearch,
  Moon,
  Sparkles,
  Sun,
  Terminal,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { useTheme } from "next-themes";
import { dispatchPrompt } from "@/lib/prompt-bus";

type Action = {
  id: string;
  label: string;
  hint?: string;
  icon: LucideIcon;
  group: "navigate" | "demo" | "actions";
  run: () => void;
};

const navItems = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Live demo", href: "#demo" },
  { label: "Built for", href: "#use-cases" },
  { label: "Security & compliance", href: "#security" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Get access", href: "#cta" },
];

const examplePrompts = [
  "Why did our AP cycle time jump 40% in Q3?",
  "Vendor ACME's invoices are 2× higher than last quarter. Diagnose.",
  "Our contract review takes 11 days. Where's the friction?",
  "Three reviewers touch every invoice under $10k. Is that the bottleneck?",
];

export function CommandPalette() {
  const [open, setOpen] = React.useState(false);
  const { setTheme, resolvedTheme } = useTheme();
  const router = useRouter();

  // ⌘K / Ctrl+K to open
  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const go = (href: string) => {
    setOpen(false);
    // small delay so the dialog closes before scrolling
    setTimeout(() => {
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
    }, 50);
  };

  const runPrompt = (prompt: string) => {
    setOpen(false);
    // navigate to demo first, then dispatch the prompt after the chat mounts
    const el = document.getElementById("demo");
    el?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => dispatchPrompt(prompt), 600);
  };

  const actions: Action[] = [
    ...navItems.map((n) => ({
      id: `nav-${n.href}`,
      label: n.label,
      hint: "Jump to section",
      icon: Sparkles,
      group: "navigate" as const,
      run: () => go(n.href),
    })),
    ...examplePrompts.map((p, i) => ({
      id: `prompt-${i}`,
      label: p.length > 50 ? p.slice(0, 50) + "…" : p,
      hint: "Ask Cadence",
      icon: BrainCircuit,
      group: "demo" as const,
      run: () => runPrompt(p),
    })),
    {
      id: "demo-chat",
      label: "Open diagnostic chat",
      hint: "Live demo",
      icon: BrainCircuit,
      group: "demo" as const,
      run: () => go("#demo"),
    },
    {
      id: "demo-docs",
      label: "Open document intelligence",
      hint: "Live demo",
      icon: FileSearch,
      group: "demo" as const,
      run: () => go("#demo"),
    },
    {
      id: "theme",
      label: resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme",
      hint: "Appearance",
      icon: resolvedTheme === "dark" ? Sun : Moon,
      group: "actions" as const,
      run: () => {
        setTheme(resolvedTheme === "dark" ? "light" : "dark");
        setOpen(false);
      },
    },
  ];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="group fixed bottom-5 right-5 z-40 hidden items-center gap-2 rounded-lg border border-border bg-background/80 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur transition-all hover:border-foreground/30 hover:text-foreground lg:inline-flex"
        aria-label="Open command palette"
      >
        <Terminal className="h-3.5 w-3.5" />
        Quick actions
        <kbd className="ml-1 inline-flex h-4 items-center gap-0.5 rounded border border-border bg-secondary px-1 font-mono text-[10px] text-muted-foreground">
          ⌘K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput placeholder="Search sections, prompts, or actions…" />
        <CommandList>
          <CommandEmpty>No results found.</CommandEmpty>
          <CommandGroup heading="Navigate">
            {actions
              .filter((a) => a.group === "navigate")
              .map((a) => (
                <CommandItem key={a.id} onSelect={() => a.run()} value={`${a.label} navigate section`}>
                  <a.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                  {a.hint ? (
                    <span className="ml-auto text-xs text-muted-foreground/60">
                      {a.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Try a prompt">
            {actions
              .filter((a) => a.group === "demo")
              .map((a) => (
                <CommandItem key={a.id} onSelect={() => a.run()} value={`${a.label} demo ask cadence`}>
                  <a.icon className="h-4 w-4 text-muted-foreground" />
                  <span className="line-clamp-1">{a.label}</span>
                  {a.hint ? (
                    <span className="ml-auto shrink-0 text-xs text-muted-foreground/60">
                      {a.hint}
                    </span>
                  ) : null}
                </CommandItem>
              ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Actions">
            {actions
              .filter((a) => a.group === "actions")
              .map((a) => (
                <CommandItem key={a.id} onSelect={() => a.run()} value={`${a.label} theme toggle appearance`}>
                  <a.icon className="h-4 w-4 text-muted-foreground" />
                  <span>{a.label}</span>
                </CommandItem>
              ))}
          </CommandGroup>
        </CommandList>
        {/* keyboard hint footer */}
        <div className="flex items-center justify-between border-t border-border px-3 py-2">
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/60">
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px]">
                ↑↓
              </kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px]">
                ↵
              </kbd>
              select
            </span>
            <span className="hidden items-center gap-1 sm:flex">
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px]">
                esc
              </kbd>
              close
            </span>
          </div>
          <span className="text-[11px] text-muted-foreground/50">
            Cadence
          </span>
        </div>
      </CommandDialog>
    </>
  );
}
