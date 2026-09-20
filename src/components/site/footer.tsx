import Link from "next/link";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Features", href: "#features" },
      { label: "Live demo", href: "#demo" },
      { label: "Pricing", href: "#pricing" },
      { label: "FAQ", href: "#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "#" },
      { label: "Careers", href: "#" },
      { label: "Security", href: "#" },
      { label: "Contact", href: "#cta" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Docs", href: "#" },
      { label: "Changelog", href: "#" },
      { label: "Status", href: "#" },
      { label: "API", href: "#" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background">
      <div className="mx-auto max-w-6xl px-6 py-14">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div className="flex flex-col gap-4">
            <Logo wordmarkClassName="bg-gradient-to-r from-foreground via-foreground/70 to-foreground/30 bg-clip-text text-transparent" />
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">
              The AI operations analyst. Diagnose your operations, prescribe
              what&apos;s next.
            </p>
            <ThemeToggle />
            <div className="mt-1 text-[11px] text-muted-foreground/50">
              Press{" "}
              <kbd className="inline-flex h-4 items-center rounded border border-border bg-secondary px-1 font-mono text-[10px] text-muted-foreground">
                ⌘K
              </kbd>{" "}
              anytime to jump.
            </div>
          </div>
          {columns.map((col) => (
            <div key={col.title} className="flex flex-col gap-3">
              <h3 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                {col.title}
              </h3>
              {col.links.map((l) => (
                <Link
                  key={l.label}
                  href={l.href}
                  className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-3 border-t border-border pt-6 sm:flex-row">
          <p className="text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} Cadence Labs. All rights reserved.
          </p>
          <div className="flex items-center gap-4 text-xs text-muted-foreground/60">
            <Link href="#" className="transition-colors hover:text-foreground">
              Privacy
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              Terms
            </Link>
            <Link href="#" className="transition-colors hover:text-foreground">
              SOC 2
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
