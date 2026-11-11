"use client";

import * as React from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import { onCookieConsentUpdated } from "@/lib/prompt-bus";

/**
 * Sticky conversion bar that slides in once the user has scrolled
 * past the hero (≈ one viewport height). Hides while the live demo
 * or final CTA section is actively in view to avoid overlapping controls.
 */
const CONSENT_KEY = "cadence:cookie-consent";

export function StickyDemoCTA() {
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const evaluateVisibility = () => {
      const y = window.scrollY;
      const vh = window.innerHeight;
      const cta = document.getElementById("cta");
      const demo = document.getElementById("demo");

      let consentDecided = true;
      try {
        consentDecided = !!localStorage.getItem(CONSENT_KEY);
      } catch {
        /* localStorage unavailable — default to decided */
      }

      const pastHero = y > vh * 0.9;
      const ctaInView = !!cta && cta.getBoundingClientRect().top < vh * 0.85;
      const demoRect = demo?.getBoundingClientRect();
      const demoInView =
        !!demoRect && demoRect.top < vh * 0.65 && demoRect.bottom > vh * 0.25;

      setVisible(consentDecided && pastHero && !ctaInView && !demoInView);
    };

    evaluateVisibility();
    window.addEventListener("scroll", evaluateVisibility, { passive: true });
    window.addEventListener("resize", evaluateVisibility, { passive: true });
    const unsubConsent = onCookieConsentUpdated(evaluateVisibility);

    return () => {
      window.removeEventListener("scroll", evaluateVisibility);
      window.removeEventListener("resize", evaluateVisibility);
      unsubConsent();
    };
  }, []);

  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-4"
        >
          <div className="flex w-full max-w-2xl items-center gap-3 rounded-xl border border-border bg-background/85 p-2.5 pl-4 shadow-[0_12px_40px_-12px_oklch(0_0_0/0.5)] backdrop-blur-xl">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-cadence-pulse rounded-full bg-cadence" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-cadence" />
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">
                  Try the live demo
                </div>
                <div className="hidden truncate text-xs text-muted-foreground sm:block">
                  Ask Cadence a question — no login required.
                </div>
              </div>
            </div>
            <Link
              href="#demo"
              className="shimmer-border ml-auto inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-all hover:translate-y-[-1px]"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Launch demo
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
