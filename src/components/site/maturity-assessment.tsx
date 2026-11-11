// Inside the result render block of the maturity assessment:
<div className="mt-8 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6">
  <h3 className="text-lg font-semibold text-emerald-400">
    Your Ops are: {scoreLabel}
  </h3>
  <p className="mt-2 text-zinc-300">
    Based on your answers, your team is losing roughly {estimatedHours} hours per week to manual workflows.
  </p>
  <div className="mt-6">
    <a 
      href="https://calendly.com/your-calendly-link"
      className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200"
    >
      Get the Automation Blueprint for this Score
    </a>
  </div>
</div>
