"use client";

import { useEffect, useRef, useState } from "react";
import { Button, Dot, Input, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type Guest = {
  name: string;
  organization: string | null;
  entryCount: number;
  hasSupportNeeds: boolean;
};

type Match = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  alreadyCheckedIn: boolean;
};

export function SelfCheckinClient({
  slug,
  returning,
  channel = "qr",
}: {
  slug: string;
  returning: Guest | null;
  /** Über welchen Weg der Gast hergekommen ist — nur für die Auswertung. */
  channel?: "qr" | "nfc";
}) {
  const [guest, setGuest] = useState<Guest | null>(returning);
  const [confirmed, setConfirmed] = useState(false);
  const [firstEntry, setFirstEntry] = useState(false);

  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<Match[]>([]);
  const [hint, setHint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!guest) inputRef.current?.focus();
  }, [guest]);

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (query.trim().length < 3) return;
    setBusy(true);
    setError(null);
    setHint(null);
    try {
      const response = await fetch(`/api/self/${slug}/find`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Die Suche hat nicht geklappt.");
        return;
      }
      setMatches(data.results ?? []);
      setHint(data.hint ?? null);
    } catch {
      setError("Keine Verbindung. Bitte WLAN prüfen.");
    } finally {
      setBusy(false);
    }
  }

  async function checkin(guestId?: string) {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/self/${slug}/checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(guestId ? { guestId } : {}), channel }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Der Check-in hat nicht geklappt.");
        return;
      }
      setGuest(data.guest);
      setFirstEntry(data.firstEntry);
      setConfirmed(true);
    } catch {
      setError("Keine Verbindung. Bitte WLAN prüfen.");
    } finally {
      setBusy(false);
    }
  }

  if (guest) {
    return (
      <GuestPass
        guest={guest}
        firstEntry={firstEntry}
        confirmed={confirmed}
        busy={busy}
        error={error}
        onConfirm={() => checkin()}
      />
    );
  }

  return (
    <div className="animate-rise mt-10 border-t border-[var(--line)] pt-8">
      <form onSubmit={search}>
        <label htmlFor="q" className="label mb-3 block">
          E-Mail oder Nachname aus Ihrer Anmeldung
        </label>
        <div className="flex">
          <Input
            id="q"
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="name@beispiel.de"
            type="text"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            enterKeyHint="search"
            className="h-12 border-r-0 text-base"
          />
          <Button type="submit" size="lg" className="shrink-0" disabled={busy || query.trim().length < 3}>
            {busy ? <Spinner className="border-[var(--page)] border-t-transparent" /> : "Suchen"}
          </Button>
        </div>
      </form>

      {error ? (
        <p className="animate-fade mt-5 border-l-2 border-[var(--color-alert)] pl-3 text-sm text-[var(--color-alert)]">
          {error}
        </p>
      ) : null}

      {matches.length > 0 ? (
        <ul className="mt-7 border-t border-[var(--line)]">
          {matches.map((match, i) => (
            <li key={match.id} className="border-b border-[var(--line)]">
              <button
                disabled={busy}
                onClick={() => checkin(match.id)}
                style={{ "--d": `${i * 60}ms` } as React.CSSProperties}
                className="animate-rise stagger flex w-full items-center gap-3 py-4 text-left transition-colors active:bg-[var(--page-sunk)] disabled:opacity-40"
              >
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{match.name}</span>
                  <span className="block truncate text-sm text-[var(--text-faint)]">
                    {[match.organization, match.email].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-[var(--color-accent)]">
                  {match.alreadyCheckedIn ? "Zurück" : "Das bin ich"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hint ? (
        <div className="mt-6 border-l-2 border-[var(--line-strong)] pl-3">
          <p className="text-sm text-[var(--text-soft)]">{hint}</p>
          <p className="mt-1.5 text-xs text-[var(--text-faint)]">
            Bitte kurz am Empfang melden — dort helfen wir sofort weiter.
          </p>
        </div>
      ) : null}
    </div>
  );
}

function GuestPass({
  guest,
  firstEntry,
  confirmed,
  busy,
  error,
  onConfirm,
}: {
  guest: Guest;
  firstEntry: boolean;
  confirmed: boolean;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
}) {
  return (
    <div className="mt-10">
      {/* Der Ausweis: invertierte Fläche, damit er am Einlass sofort erkennbar ist. */}
      <div
        className={cn(
          "animate-wipe px-5 py-6",
          confirmed
            ? "bg-[var(--text)] text-[var(--page)]"
            : "border border-[var(--line-strong)]",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <p className={cn("label", confirmed && "text-[var(--page)] opacity-60")}>
            {confirmed ? (firstEntry ? "Angemeldet" : "Wiedereintritt") : "Ihr Ausweis"}
          </p>

          {confirmed ? (
            <svg
              viewBox="0 0 48 48"
              className="h-7 w-7 shrink-0"
              fill="none"
              stroke="currentColor"
              strokeWidth="4.5"
              strokeLinecap="square"
            >
              <path d="m10 25 10 10 18-22" strokeDasharray="52" strokeDashoffset="52" className="animate-draw" />
            </svg>
          ) : null}
        </div>

        <p className="mt-6 text-[1.75rem] leading-tight font-medium tracking-[-0.03em] text-balance">
          {guest.name}
        </p>
        {guest.organization ? (
          <p className={cn("mt-1.5 text-sm", confirmed ? "opacity-65" : "text-[var(--text-soft)]")}>
            {guest.organization}
          </p>
        ) : null}

        <div
          className={cn(
            "mt-7 flex items-center justify-between border-t pt-4 text-sm",
            confirmed ? "border-[var(--page)]/20" : "border-[var(--line)]",
          )}
        >
          <span className={cn("num", confirmed ? "opacity-65" : "text-[var(--text-faint)]")}>
            {guest.entryCount > 1 ? `${guest.entryCount}. Eintritt heute` : "Erster Eintritt"}
          </span>
          {confirmed ? (
            <span className="flex items-center gap-2 text-xs tracking-[0.06em] uppercase opacity-80">
              <span className="h-1.5 w-1.5 bg-current animate-tick" />
              gültig
            </span>
          ) : null}
        </div>
      </div>

      {guest.hasSupportNeeds ? (
        <p className="animate-rise mt-5 border-l-2 border-[var(--color-accent)] pl-3 text-sm text-[var(--text-soft)]">
          Sie haben Unterstützung angemeldet. Unser Team ist informiert und kommt auf Sie zu.
        </p>
      ) : null}

      {error ? (
        <p className="animate-fade mt-5 border-l-2 border-[var(--color-alert)] pl-3 text-sm text-[var(--color-alert)]">
          {error}
        </p>
      ) : null}

      {confirmed ? (
        <p className="animate-rise mt-7 flex items-start gap-2 text-sm text-[var(--text-soft)]">
          <Dot tone="accent" className="mt-1.5" />
          {firstEntry
            ? "Willkommen! Beim Wiedereintritt einfach dieselbe Plakette oder denselben Code erneut nutzen."
            : "Willkommen zurück!"}
        </p>
      ) : (
        <>
          <p className="mt-7 text-sm text-[var(--text-soft)]">
            Sie sind bereits angemeldet. Für den Wiedereintritt einmal bestätigen.
          </p>
          <Button size="xl" className="mt-4 w-full" onClick={onConfirm} disabled={busy}>
            {busy ? <Spinner className="border-[var(--page)] border-t-transparent" /> : "Wiedereintritt bestätigen"}
          </Button>
        </>
      )}
    </div>
  );
}
