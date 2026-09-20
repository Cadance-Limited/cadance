import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      className={cn("h-7 w-7", className)}
      aria-hidden="true"
    >
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="31"
        rx="8.5"
        className="fill-foreground"
      />
      {/* subtle inner highlight for depth */}
      <rect
        x="0.5"
        y="0.5"
        width="31"
        height="15"
        rx="8.5"
        className="fill-white/[0.06]"
      />
      <path
        d="M6 16.2h3.4l2-4.2 3.2 8.6 2.4-6.4 1.8 3.4H26"
        className="stroke-background"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function Logo({
  className,
  showWordmark = true,
  wordmarkClassName,
}: {
  className?: string;
  showWordmark?: boolean;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <span className="relative">
        <LogoMark />
      </span>
      {showWordmark && (
        <span
          className={cn(
            "text-[17px] font-semibold tracking-tight text-foreground",
            wordmarkClassName,
          )}
        >
          Cadence
        </span>
      )}
    </span>
  );
}
