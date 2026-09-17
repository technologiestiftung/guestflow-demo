import { cn } from "@/lib/utils";

/**
 * Bildmarke GuestFlow.
 *
 * Drei Balken laufen von links ein — die Schlange am Einlass — und enden in
 * einem Haken. Alles auf demselben Raster, rechtwinklig, mit stumpfen Enden.
 * Einfarbig über currentColor, damit die Marke auf Papier, Schild und Schirm
 * identisch funktioniert.
 */
export function GuestFlowMark({
  className,
  animated = false,
}: {
  className?: string;
  animated?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 32 32"
      role="img"
      aria-label="GuestFlow"
      className={cn("h-6 w-6", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="square"
    >
      <g opacity="0.45">
        {[
          { d: "M2 9h6", delay: "0ms" },
          { d: "M2 16h10", delay: "70ms" },
          { d: "M2 23h6", delay: "140ms" },
        ].map((bar) => (
          <path
            key={bar.d}
            d={bar.d}
            className={cn(animated && "animate-wipe stagger")}
            style={animated ? ({ "--d": bar.delay } as React.CSSProperties) : undefined}
          />
        ))}
      </g>
      <path
        d="M13 17.5 18.5 23 30 9"
        strokeWidth="3"
        className={cn(animated && "animate-draw")}
        style={animated ? { strokeDasharray: 34, strokeDashoffset: 34 } : undefined}
      />
    </svg>
  );
}

export function GuestFlowLogo({
  className,
  size = "md",
  animated = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  animated?: boolean;
}) {
  const scale = {
    sm: { mark: "h-[18px] w-[18px]", text: "text-[0.9375rem]" },
    md: { mark: "h-5 w-5", text: "text-base" },
    lg: { mark: "h-7 w-7", text: "text-xl" },
  }[size];

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <GuestFlowMark className={cn(scale.mark, "text-[var(--text)]")} animated={animated} />
      <span className={cn("font-medium tracking-[-0.03em]", scale.text)}>
        Guest<span className="text-[var(--text-faint)]">Flow</span>
      </span>
    </span>
  );
}

/** Wortmarke ohne Bildmarke — für Namensschild und Aushang. */
export function GuestFlowWordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-medium tracking-[-0.02em]", className)}>
      Guest<span className="opacity-45">Flow</span>
    </span>
  );
}
