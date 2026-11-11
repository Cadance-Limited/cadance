// src/components/site/cta-email.tsx
import { ArrowRight } from "lucide-react";
import Link from "next/link";

export function CTAEmail() {
  return (
    <section className="relative overflow-hidden bg-zinc-950 py-24 sm:py-32 border-t border-white/10">
      <div className="mx-auto max-w-7xl px-6 lg:px-8 text-center">
        <h2 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">
          Ready to automate your bottlenecks?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">
          Currently accepting 3 new clients for the current quarter. 
          Book a 15-minute diagnostic call. No pitch, just the fix.
        </p>
        
        <div className="mt-10 flex items-center justify-center gap-x-6">
          <Link
            href="https://calendly.com/your-calendly-link" // <- UPDATE THIS IN 2028
            className="group flex items-center gap-2 rounded-full bg-emerald-500 px-8 py-3.5 text-sm font-semibold text-white shadow-sm hover:bg-emerald-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500 transition-all"
          >
            Book Diagnostic Call
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </div>
        
        <p className="mt-6 text-sm text-zinc-500">
          Or email me directly at <a href="mailto:hello@cadance.com" className="text-zinc-300 hover:text-white underline">hello@cadance.com</a>
        </p>
      </div>
    </section>
  );
}
