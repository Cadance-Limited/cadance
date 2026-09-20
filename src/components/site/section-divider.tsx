export function SectionDivider({ className }: { className?: string }) {
  return (
    <div
      className={`mx-auto h-px max-w-5xl bg-gradient-to-r from-transparent via-border to-transparent ${className ?? ""}`}
      aria-hidden="true"
    />
  );
}
