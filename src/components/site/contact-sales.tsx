"use client";

import * as React from "react";
import { motion } from "framer-motion";
import { ArrowRight, Check, Loader2, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

export function ContactSalesModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [email, setEmail] = React.useState("");
  const [name, setName] = React.useState("");
  const [company, setCompany] = React.useState("");
  const [seats, setSeats] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "done">("idle");
  const { toast } = useToast();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (status === "loading") return;
    setStatus("loading");
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          company: company.trim() || undefined,
          role: seats ? `Scale — ${seats} seats` : "Scale",
          source: "contact-sales",
        }),
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || "Try again");
      setStatus("done");
      toast({
        title: "Request received",
        description: "A solutions engineer will reach out within one business day.",
      });
    } catch (err) {
      setStatus("idle");
      toast({
        title: "Couldn't submit",
        description: err instanceof Error ? err.message : "Unknown error",
        variant: "destructive",
      });
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-0 border-border bg-background p-0">
        <DialogHeader className="border-b border-border px-6 py-5">
          <DialogTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Shield className="h-4 w-4 text-cadence" />
            Talk to sales — Scale plan
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            For finance and ops orgs that need SSO, audit logs, and custom
            diagnostic rules. We reply within one business day.
          </DialogDescription>
        </DialogHeader>

        {status === "done" ? (
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-cadence/10 text-cadence">
              <Check className="h-5 w-5" />
            </span>
            <div>
              <div className="text-sm font-medium text-foreground">
                Request received
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                A solutions engineer will reach out to {email} within one
                business day.
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-3 p-6">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                />
              </Field>
              <Field label="Company">
                <input
                  type="text"
                  required
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Acme Co."
                  className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
                />
              </Field>
            </div>
            <Field label="Work email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="jane@acme.co"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
              />
            </Field>
            <Field label="How many seats? (optional)">
              <input
                type="text"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
                placeholder="e.g. 25–50"
                className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-foreground/30 focus:outline-none"
              />
            </Field>

            <button
              type="submit"
              disabled={status === "loading"}
              className="shimmer-border mt-2 inline-flex h-10 items-center justify-center gap-1.5 rounded-lg bg-foreground px-4 text-sm font-medium text-background transition-all hover:translate-y-[-1px] disabled:opacity-60"
            >
              {status === "loading" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  Request access
                  <ArrowRight className="h-3.5 w-3.5" />
                </>
              )}
            </button>
            <p className="text-center text-[11px] text-muted-foreground/50">
              No credit card. No sales pressure. Just a 20-minute scoping call.
            </p>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}
