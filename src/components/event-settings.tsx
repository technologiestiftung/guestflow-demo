"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SectionHead } from "@/components/ui";
import { cn } from "@/lib/utils";

type Flags = {
  selfServiceEnabled: boolean;
  badgePrinting: boolean;
  manualSearch: boolean;
  emailOnlyLookup: boolean;
  allowReEntry: boolean;
};

const OPTIONS: { key: keyof Flags; label: string; hint: string }[] = [
  {
    key: "selfServiceEnabled",
    label: "Selbstanmeldung per Telefon",
    hint: "Gäste nutzen QR-Aushang oder NFC-Plakette am Eingang.",
  },
  {
    key: "badgePrinting",
    label: "Namensschild drucken",
    hint: "Beim ersten Check-in geht das Schild an die Druckstation.",
  },
  {
    key: "manualSearch",
    label: "Suche am Kiosk",
    hint: "Fallback am Kiosk, wenn der QR-Code nicht lesbar ist.",
  },
  {
    key: "emailOnlyLookup",
    label: "Nur exakte E-Mail-Suche",
    hint: "Keine Namenssuche. Gefunden wird nur, wer die vollständige Adresse oder den Ticketcode eingibt — so bekommt niemand fremde Namen zu sehen.",
  },
  {
    key: "allowReEntry",
    label: "Wiedereintritt erlauben",
    hint: "Aus: Wer schon da war, wird zum Team geschickt.",
  },
];

export function EventSettings({ eventId, flags }: { eventId: string; flags: Flags }) {
  const router = useRouter();
  const [state, setState] = useState(flags);
  const [busy, setBusy] = useState<string | null>(null);

  async function toggle(key: keyof Flags) {
    const next = !state[key];
    setState((prev) => ({ ...prev, [key]: next }));
    setBusy(key);

    const response = await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [key]: next }),
    }).catch(() => null);

    setBusy(null);
    // Bei Fehlschlag zurückstellen, statt etwas Falsches anzuzeigen.
    if (!response?.ok) setState((prev) => ({ ...prev, [key]: !next }));
    else router.refresh();
  }

  return (
    <section>
      <SectionHead>Einstellungen</SectionHead>

      <ul className="divide-y divide-[var(--line)]">
        {OPTIONS.map((option) => (
          <li key={option.key}>
            <button
              type="button"
              role="switch"
              aria-checked={state[option.key]}
              aria-describedby={`${option.key}-hint`}
              onClick={() => toggle(option.key)}
              disabled={busy === option.key}
              className="flex w-full items-start justify-between gap-4 py-3.5 text-left transition-colors hover:bg-[var(--page-sunk)] disabled:opacity-50"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium">{option.label}</span>
                <span id={`${option.key}-hint`} className="block text-xs text-[var(--text-faint)]">
                  {option.hint}
                </span>
              </span>

              {/* Schalter als zwei Quadrate — passt zur kantigen Sprache. */}
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-5 w-9 shrink-0 items-center border p-[2px] transition-colors duration-150",
                  state[option.key]
                    ? "border-[var(--text)] bg-[var(--text)]"
                    : "border-[var(--line-strong)]",
                )}
              >
                <span
                  className={cn(
                    "h-[14px] w-[14px] transition-transform duration-150",
                    state[option.key]
                      ? "translate-x-[16px] bg-[var(--page)]"
                      : "translate-x-0 bg-[var(--line-strong)]",
                  )}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function DataPanel({
  eventId,
  eventName,
  guestCount,
}: {
  eventId: string;
  eventName: string;
  guestCount: number;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function purge(mode: "guests" | "event") {
    const question =
      mode === "guests"
        ? `Alle ${guestCount} Gästedaten von „${eventName}" endgültig löschen?\n\nDie Veranstaltung bleibt bestehen. Bitte vorher die Teilnahmeliste exportieren.`
        : `Veranstaltung „${eventName}" mitsamt allen Gästedaten endgültig löschen?`;
    if (!confirm(question)) return;

    setBusy(true);
    const response = await fetch(`/api/events/${eventId}?mode=${mode}`, { method: "DELETE" });
    setBusy(false);
    if (!response.ok) return;
    if (mode === "event") router.push("/admin");
    else router.refresh();
  }

  const row =
    "flex w-full items-center justify-between gap-4 py-3.5 text-left transition-colors hover:bg-[var(--page-sunk)] disabled:opacity-40";

  return (
    <section>
      <SectionHead>Daten</SectionHead>

      <p className="py-3 text-sm text-[var(--text-soft)]">
        Teilnahmeliste für die Nachweispflicht sichern, danach die personenbezogenen Daten löschen.
      </p>

      <div className="divide-y divide-[var(--line)] border-t border-[var(--line)]">
        <a href={`/api/events/${eventId}/export`} className={row}>
          <span>
            <span className="block text-sm font-medium">Teilnahmeliste exportieren</span>
            <span className="block text-xs text-[var(--text-faint)]">
              CSV mit Anwesenheit und Zeitstempeln
            </span>
          </span>
          <span className="text-[var(--text-faint)]">↓</span>
        </a>

        <button onClick={() => purge("guests")} disabled={busy || guestCount === 0} className={row}>
          <span>
            <span className="block text-sm font-medium text-[var(--color-alert)]">
              Gästedaten löschen
            </span>
            <span className="block text-xs text-[var(--text-faint)]">
              {guestCount} Datensätze — Veranstaltung bleibt bestehen
            </span>
          </span>
        </button>

        <button onClick={() => purge("event")} disabled={busy} className={row}>
          <span>
            <span className="block text-sm font-medium text-[var(--color-alert)]">
              Veranstaltung löschen
            </span>
            <span className="block text-xs text-[var(--text-faint)]">
              samt Gästen und Protokoll
            </span>
          </span>
        </button>
      </div>
    </section>
  );
}
