export function cn(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

const BERLIN = "Europe/Berlin";

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: BERLIN,
  }).format(new Date(value));
}

export function formatTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short",
    timeZone: BERLIN,
  }).format(new Date(value));
}

export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeZone: BERLIN,
  }).format(new Date(value));
}

/** "vor 3 Min." für die Live-Ansicht. */
export function relativeTime(value: Date | string | null | undefined): string {
  if (!value) return "—";
  const diffMs = new Date(value).getTime() - Date.now();
  const formatter = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ["second", 1000],
    ["minute", 60_000],
    ["hour", 3_600_000],
    ["day", 86_400_000],
  ];
  let chosen: [Intl.RelativeTimeFormatUnit, number] = units[0];
  for (const unit of units) {
    if (Math.abs(diffMs) >= unit[1]) chosen = unit;
  }
  return formatter.format(Math.round(diffMs / chosen[1]), chosen[0]);
}

export function initials(firstName: string, lastName: string): string {
  return `${firstName.at(0) ?? ""}${lastName.at(0) ?? ""}`.toUpperCase() || "?";
}

/** Eingaben aus dem Kiosk begrenzen, bevor sie in eine Query gehen. */
export function clampString(value: unknown, max: number): string {
  return typeof value === "string" ? value.slice(0, max).trim() : "";
}
