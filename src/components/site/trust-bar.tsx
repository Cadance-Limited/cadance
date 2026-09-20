const logos = [
  "Northwind",
  "Vela",
  "Helix",
  "Aurora",
  "Quanta",
  "Meridian",
];

const stats = [
  { value: "1.2M+", label: "documents analyzed" },
  { value: "6.2 hrs", label: "saved per week, per team" },
  { value: "73%", label: "faster contract review" },
  { value: "98%", label: "anomaly recall vs. manual audit" },
];

export function TrustBar() {
  return (
    <section className="relative border-y border-border bg-secondary/20">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Trusted by operations teams at modern companies
        </p>
        <div className="mask-fade-x mt-7 flex flex-wrap items-center justify-center gap-x-10 gap-y-5 sm:gap-x-14">
          {logos.map((name) => (
            <span
              key={name}
              className="text-lg font-semibold tracking-tight text-muted-foreground/60 transition-colors hover:text-foreground"
            >
              {name}
            </span>
          ))}
        </div>

        <div className="mt-10 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border md:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-background p-5 text-center sm:p-6">
              <div className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                {s.value}
              </div>
              <div className="mt-1 text-xs text-muted-foreground sm:text-sm">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
