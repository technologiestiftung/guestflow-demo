import Link from "next/link";
import { cn } from "@/lib/utils";

/* ---------------------------------------------------------------------------
   Bausteine. Scharfe Kanten, Haarlinien, eine Akzentfarbe.
   Flächen tragen nie Schatten — Tiefe entsteht durch Linien und Weißraum.
   --------------------------------------------------------------------------- */

type ButtonVariant = "primary" | "outline" | "quiet" | "danger";
type ButtonSize = "sm" | "md" | "lg" | "xl";

const VARIANTS: Record<ButtonVariant, string> = {
  // Die Hauptaktion ist invertiert — der stärkste Kontrast auf der Seite.
  primary:
    "bg-[var(--text)] text-[var(--page)] border border-[var(--text)] hover:bg-[var(--color-accent)] hover:border-[var(--color-accent)]",
  outline:
    "border border-[var(--line-strong)] text-[var(--text)] hover:border-[var(--text)] hover:bg-[var(--page-sunk)]",
  quiet:
    "border border-transparent text-[var(--text-soft)] hover:text-[var(--text)] hover:bg-[var(--page-sunk)]",
  danger:
    "border border-[var(--color-alert)] text-[var(--color-alert)] hover:bg-[var(--color-alert)] hover:text-[var(--page)]",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-[0.8125rem] gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-12 px-6 text-[0.9375rem] gap-2",
  xl: "h-16 px-8 text-base gap-2.5",
};

const BASE =
  "inline-flex items-center justify-center whitespace-nowrap rounded-none font-medium " +
  "transition-colors duration-150 select-none disabled:opacity-40 disabled:pointer-events-none";

export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
) {
  return cn(BASE, VARIANTS[variant], SIZES[size], className);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentPropsWithRef<"button"> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: ButtonVariant; size?: ButtonSize }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Input({ className, ...props }: React.ComponentPropsWithRef<"input">) {
  return (
    <input
      className={cn(
        "w-full rounded-none border border-[var(--line-strong)] bg-transparent px-3.5 py-2.5",
        "text-[var(--text)] transition-colors duration-150",
        "hover:border-[var(--text-faint)] focus:border-[var(--color-accent)] focus:outline-none",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.ComponentPropsWithRef<"label">) {
  return <label className={cn("label mb-2 block", className)} {...props} />;
}

/** Die Grundfläche: Haarlinie außen, sonst nichts. */
export function Card({ className, ...props }: React.ComponentPropsWithRef<"div">) {
  return <div className={cn("panel", className)} {...props} />;
}

/** Abschnittsüberschrift mit durchlaufender Linie — gliedert lange Seiten. */
export function SectionHead({
  children,
  action,
  className,
}: {
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-4 border-b border-[var(--line)] pb-2.5", className)}>
      <h2 className="label">{children}</h2>
      <span className="h-px flex-1 bg-[var(--line)]" />
      {action}
    </div>
  );
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: React.ComponentPropsWithRef<"span"> & {
  tone?: "neutral" | "accent" | "signal" | "alert" | "solid";
}) {
  const tones = {
    neutral: "border-[var(--line-strong)] text-[var(--text-soft)]",
    accent: "border-[var(--color-accent)] text-[var(--color-accent)]",
    signal: "border-[var(--color-signal)] text-[var(--color-signal)]",
    alert: "border-[var(--color-alert)] text-[var(--color-alert)]",
    solid: "border-[var(--text)] bg-[var(--text)] text-[var(--page)]",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-none border px-2 py-[3px]",
        "text-[0.6875rem] leading-none font-medium tracking-[0.06em] uppercase",
        tones[tone],
        className,
      )}
      {...props}
    />
  );
}

/** Kleines Quadrat statt Punkt — passt zur kantigen Sprache. */
export function Dot({
  tone = "accent",
  pulse = false,
  className,
}: {
  tone?: "accent" | "signal" | "alert" | "faint";
  pulse?: boolean;
  className?: string;
}) {
  const colors = {
    accent: "bg-[var(--color-accent)]",
    signal: "bg-[var(--color-signal)]",
    alert: "bg-[var(--color-alert)]",
    faint: "bg-[var(--text-faint)]",
  };
  return (
    <span className={cn("relative inline-flex h-1.5 w-1.5 shrink-0", className)}>
      {pulse ? (
        <span className={cn("absolute inset-0 animate-ping-square", colors[tone])} />
      ) : null}
      <span className={cn("relative h-1.5 w-1.5", colors[tone])} />
    </span>
  );
}

/**
 * Kennzahl. Die Zahl trägt die Aufmerksamkeit, die Beschriftung ordnet sie ein.
 * Getrennt werden Kacheln durch Linien des Rasters, nicht durch Kästen.
 */
export function Stat({
  label,
  value,
  hint,
  tone = "neutral",
  delay = 0,
}: {
  label: string;
  value: React.ReactNode;
  hint?: string;
  tone?: "neutral" | "accent" | "signal";
  delay?: number;
}) {
  const valueTone = {
    neutral: "text-[var(--text)]",
    accent: "text-[var(--color-accent)]",
    signal: "text-[var(--color-signal)]",
  }[tone];

  return (
    <div
      className="animate-rise stagger px-5 py-5"
      style={{ "--d": `${delay}ms` } as React.CSSProperties}
    >
      <p className="label">{label}</p>
      <p className={cn("num mt-3 text-[2.75rem] leading-none font-medium", valueTone)}>{value}</p>
      {hint ? <p className="mt-2 text-[0.8125rem] text-[var(--text-faint)]">{hint}</p> : null}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="panel animate-rise px-6 py-16 text-center">
      <h3 className="text-base font-medium">{title}</h3>
      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--text-soft)] text-pretty">
        {description}
      </p>
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

/** Ladeanzeige: ein rotierendes Quadrat, kein Kreis. */
export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-rotate border border-[var(--text-faint)] border-t-[var(--text)]",
        className,
      )}
    />
  );
}
