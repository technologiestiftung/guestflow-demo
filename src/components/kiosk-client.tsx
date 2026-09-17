"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { GuestFlowLogo } from "@/components/brand";
import { Button, Dot, Input, Spinner } from "@/components/ui";
import { useKeyboardWedge, useScanner, type CameraOption } from "@/components/use-scanner";
import { cn } from "@/lib/utils";

type CheckinGuest = {
  id: string;
  name: string;
  firstName: string;
  lastName: string;
  organization: string | null;
  email: string | null;
  entryCount: number;
  hasSupportNeeds: boolean;
};

type CheckinResponse = {
  result: "checked_in" | "re_entry" | "not_found" | "wrong_event";
  message: string;
  firstEntry: boolean;
  badgePrinting: boolean;
  guest: CheckinGuest | null;
};

type SearchResult = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  alreadyCheckedIn: boolean;
};

/** Vom Server gereicht; bewusst nicht aus guest-lookup importiert — das Modul
 *  hängt an der Datenbank und gehört nicht ins Browser-Bundle. */
export type SearchLabels = { label: string; placeholder: string; help: string };

const RESET_AFTER_SUCCESS = 6000;
const RESET_AFTER_ERROR = 9000;

export function KioskClient({
  slug,
  eventName,
  manualSearch,
  badgePrinting,
  searchLabels,
}: {
  slug: string;
  eventName: string;
  manualSearch: boolean;
  badgePrinting: boolean;
  searchLabels: SearchLabels;
}) {
  const [mode, setMode] = useState<"scan" | "search">("scan");
  const [busy, setBusy] = useState(false);
  const [outcome, setOutcome] = useState<CheckinResponse | null>(null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searchHint, setSearchHint] = useState<string | null>(null);

  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCodeRef = useRef<{ code: string; at: number }>({ code: "", at: 0 });

  const clearResetTimer = () => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    resetTimer.current = null;
  };

  const reset = useCallback(() => {
    clearResetTimer();
    setOutcome(null);
    setQuery("");
    setResults([]);
    setSearchHint(null);
    setMode("scan");
  }, []);

  const submit = useCallback(
    async (payload: { code?: string; guestId?: string; method: "qr" | "manual" }) => {
      setBusy(true);
      clearResetTimer();
      try {
        const response = await fetch(`/api/kiosk/${slug}/checkin`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        const data = (await response.json()) as CheckinResponse & { error?: string };
        if (!response.ok) {
          setOutcome({
            result: "not_found",
            message: data.error ?? "Es ist ein Fehler aufgetreten.",
            firstEntry: false,
            badgePrinting,
            guest: null,
          });
        } else {
          setOutcome(data);
          if (data.firstEntry && data.badgePrinting && data.guest) printBadge(data.guest.id);
        }
      } catch {
        setOutcome({
          result: "not_found",
          message: "Keine Verbindung zum Server.",
          firstEntry: false,
          badgePrinting,
          guest: null,
        });
      } finally {
        setBusy(false);
      }
    },
    [slug, badgePrinting],
  );

  const handleCode = useCallback(
    (raw: string) => {
      const code = raw.trim();
      if (!code) return;
      const now = Date.now();
      // Die Kamera liefert denselben Code mehrmals pro Sekunde — nur der erste zählt.
      if (lastCodeRef.current.code === code && now - lastCodeRef.current.at < 4000) return;
      lastCodeRef.current = { code, at: now };
      submit({ code, method: "qr" });
    },
    [submit],
  );

  const scannerActive = mode === "scan" && !outcome && !busy;
  const { videoRef, status, message, cameras, deviceId, selectCamera } = useScanner(
    handleCode,
    scannerActive,
  );
  useKeyboardWedge(handleCode, !outcome && !busy);

  useEffect(() => {
    if (!outcome) return;
    const success = outcome.result === "checked_in" || outcome.result === "re_entry";
    resetTimer.current = setTimeout(reset, success ? RESET_AFTER_SUCCESS : RESET_AFTER_ERROR);
    return clearResetTimer;
  }, [outcome, reset]);

  useEffect(() => {
    if (mode !== "search") return;
    if (query.trim().length < 3) {
      setResults([]);
      setSearchHint(null);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/kiosk/${slug}/search?q=${encodeURIComponent(query.trim())}`,
          { signal: controller.signal },
        );
        const data = await response.json();
        setResults(data.results ?? []);
        setSearchHint(data.hint ?? data.error ?? null);
      } catch {
        /* abgebrochene Anfrage ist kein Fehler */
      }
    }, 280);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query, mode, slug]);

  // Das Ergebnis übernimmt den ganzen Schirm — aus zwei Metern Abstand lesbar.
  if (outcome) {
    return (
      <ResultScreen
        outcome={outcome}
        manualSearch={manualSearch}
        onReset={reset}
        onSearch={() => {
          reset();
          setMode("search");
        }}
      />
    );
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-[var(--line)] px-6 py-4 sm:px-10">
        <GuestFlowLogo size="sm" />
        <p className="label max-w-[55vw] truncate">{eventName}</p>
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-10 sm:px-10">
        {mode === "scan" ? (
          <ScanPanel
            videoRef={videoRef}
            live={status === "running"}
            message={message}
            busy={busy}
            manualSearch={manualSearch}
            onSearch={() => setMode("search")}
            cameras={cameras}
            deviceId={deviceId}
            onSelectCamera={selectCamera}
          />
        ) : (
          <SearchPanel
            query={query}
            onQuery={setQuery}
            results={results}
            hint={searchHint}
            busy={busy}
            onPick={(id) => submit({ guestId: id, method: "manual" })}
            onBack={reset}
            labels={searchLabels}
          />
        )}
      </main>
    </div>
  );
}

/** Namensschild in einem versteckten Rahmen drucken, ohne den Kiosk zu verlassen. */
function printBadge(guestId: string) {
  document.getElementById("badge-frame")?.remove();

  const frame = document.createElement("iframe");
  frame.id = "badge-frame";
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;";
  frame.src = `/badge/${guestId}`;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      /* Kein Drucker eingerichtet — der Check-in gilt trotzdem. */
    }
  };
  document.body.appendChild(frame);
}

function ScanPanel({
  videoRef,
  live,
  message,
  busy,
  manualSearch,
  onSearch,
  cameras,
  deviceId,
  onSelectCamera,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  live: boolean;
  message: string | null;
  busy: boolean;
  manualSearch: boolean;
  onSearch: () => void;
  cameras: CameraOption[];
  deviceId: string | null;
  onSelectCamera: (id: string) => void;
}) {
  return (
    <div className="grid w-full max-w-5xl items-center gap-12 lg:grid-cols-2 lg:gap-20">
      <div className="order-2 lg:order-1">
        <p className="label animate-rise">Check-in</p>

        <h1
          className="animate-rise stagger mt-6 text-[2.5rem] leading-[1.03] font-medium tracking-[-0.035em] text-balance sm:text-[3.75rem]"
          style={{ "--d": "60ms" } as React.CSSProperties}
        >
          Willkommen.
          <br />
          <span className="text-[var(--text-faint)]">QR-Code vor die Kamera halten.</span>
        </h1>

        <p
          className="animate-rise stagger mt-7 max-w-sm leading-relaxed text-[var(--text-soft)] text-pretty"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          Den Code aus Ihrer Anmeldebestätigung. Der Check-in dauert keine zwei Sekunden.
        </p>

        <div
          className="animate-rise stagger mt-9 flex flex-wrap items-center gap-4"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          <span className="flex items-center gap-2 text-sm text-[var(--text-soft)]">
            <Dot tone={live ? "accent" : "signal"} pulse={live} />
            {busy ? "Prüfe Anmeldung" : live ? "Kamera bereit" : "Kamera startet"}
          </span>

          {manualSearch ? (
            <Button variant="outline" size="md" onClick={onSearch}>
              Code funktioniert nicht?
            </Button>
          ) : null}
        </div>

        {message ? (
          <p className="animate-fade mt-5 border-l-2 border-[var(--color-signal)] pl-3 text-sm text-[var(--color-signal)]">
            {message}
          </p>
        ) : null}
      </div>

      <div className="order-1 mx-auto w-full max-w-sm lg:order-2 lg:max-w-none">
        <ScannerViewport videoRef={videoRef} live={live} busy={busy} />
        <CameraPicker cameras={cameras} deviceId={deviceId} onSelect={onSelectCamera} />
      </div>
    </div>
  );
}

function ScannerViewport({
  videoRef,
  live,
  busy,
}: {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  live: boolean;
  busy: boolean;
}) {
  return (
    <div className="animate-wipe relative aspect-square w-full border border-[var(--text)]">
      <video ref={videoRef} className="h-full w-full object-cover" muted playsInline autoPlay />

      {!live || busy ? (
        <div className="absolute inset-0 grid place-items-center bg-[var(--page)]">
          <div className="flex flex-col items-center gap-3">
            <Spinner className="h-5 w-5" />
            <p className="label">{busy ? "Prüfe Anmeldung" : "Kamera startet"}</p>
          </div>
        </div>
      ) : null}

      {/* Zielrahmen: vier Winkel, dazu eine laufende Linie. Keine Effekte. */}
      <div className="pointer-events-none absolute inset-0 p-10">
        <div className="relative h-full w-full">
          {[
            "top-0 left-0 border-t-2 border-l-2",
            "top-0 right-0 border-t-2 border-r-2",
            "bottom-0 left-0 border-b-2 border-l-2",
            "bottom-0 right-0 border-b-2 border-r-2",
          ].map((corner) => (
            <span
              key={corner}
              className={cn("absolute h-8 w-8 border-[var(--color-accent)]", corner)}
            />
          ))}

          {live && !busy ? (
            <span className="absolute inset-x-0 top-0 h-px bg-[var(--color-accent)] animate-scan" />
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * Tablets haben mehrere Kameras, und nur wer davor steht, weiß welche auf die
 * Gäste zeigt. Deshalb die Auswahl direkt am Sucher — unaufdringlich, aber
 * erreichbar, ohne den Kiosk zu verlassen. Die Wahl bleibt auf dem Gerät.
 */
function CameraPicker({
  cameras,
  deviceId,
  onSelect,
}: {
  cameras: CameraOption[];
  deviceId: string | null;
  onSelect: (id: string) => void;
}) {
  if (cameras.length < 2) return null;

  return (
    <div className="animate-fade mt-3 flex flex-wrap items-center gap-2">
      <span className="label">Kamera</span>
      {cameras.map((camera, index) => {
        const active = deviceId === camera.deviceId;
        return (
          <button
            key={camera.deviceId || index}
            onClick={() => onSelect(camera.deviceId)}
            aria-pressed={active}
            title={camera.label}
            className={cn(
              "max-w-[10rem] truncate border px-2 py-1 text-xs transition-colors",
              active
                ? "border-[var(--text)] bg-[var(--text)] text-[var(--page)]"
                : "border-[var(--line-strong)] text-[var(--text-faint)] hover:border-[var(--text)] hover:text-[var(--text)]",
            )}
          >
            {camera.label}
          </button>
        );
      })}
    </div>
  );
}

function ResultScreen({
  outcome,
  manualSearch,
  onReset,
  onSearch,
}: {
  outcome: CheckinResponse;
  manualSearch: boolean;
  onReset: () => void;
  onSearch: () => void;
}) {
  const welcome = outcome.result === "checked_in" || outcome.result === "re_entry";

  // Erfolg invertiert die Fläche: aus jeder Entfernung eindeutig.
  if (welcome && outcome.guest) {
    const first = outcome.result === "checked_in";
    return (
      <div className="animate-fade flex min-h-dvh flex-col bg-[var(--text)] px-6 py-10 text-[var(--page)] sm:px-16">
        <div className="flex items-center justify-between">
          <p className="label text-[var(--page)] opacity-60">
            {first ? "Angemeldet" : "Wiedereintritt"}
          </p>
          <svg
            viewBox="0 0 48 48"
            className="h-9 w-9"
            fill="none"
            stroke="currentColor"
            strokeWidth="4"
            strokeLinecap="square"
          >
            <path d="m10 25 10 10 18-22" strokeDasharray="52" strokeDashoffset="52" className="animate-draw" />
          </svg>
        </div>

        <div className="flex flex-1 flex-col justify-center">
          <p
            className="animate-rise stagger text-[3rem] leading-[0.98] font-medium tracking-[-0.04em] text-balance sm:text-[6rem]"
            style={{ "--d": "80ms" } as React.CSSProperties}
          >
            {outcome.guest.name}
          </p>

          {outcome.guest.organization ? (
            <p
              className="animate-rise stagger mt-6 text-xl opacity-60 sm:text-2xl"
              style={{ "--d": "160ms" } as React.CSSProperties}
            >
              {outcome.guest.organization}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-end justify-between gap-6 border-t border-[var(--page)]/20 pt-6">
          <div className="space-y-1.5">
            {first && outcome.badgePrinting ? (
              <p className="text-sm opacity-70">Ihr Namensschild wird gedruckt.</p>
            ) : null}
            {!first ? (
              <p className="num text-sm opacity-70">{outcome.guest.entryCount}. Eintritt heute</p>
            ) : null}
            {outcome.guest.hasSupportNeeds ? (
              <p className="text-sm opacity-70">
                Unser Team ist über Ihren Unterstützungsbedarf informiert.
              </p>
            ) : null}
          </div>

          <button
            onClick={onReset}
            className="border border-[var(--page)]/40 px-4 py-2 text-sm transition-colors hover:bg-[var(--page)] hover:text-[var(--text)]"
          >
            Weiter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col justify-center px-6 py-10 sm:px-16">
      <div className="mx-auto w-full max-w-2xl">
        <p className="label animate-rise text-[var(--color-alert)]">Nicht gefunden</p>

        <h1
          className="animate-rise stagger mt-6 text-[2.25rem] leading-[1.05] font-medium tracking-[-0.035em] text-balance sm:text-[3.25rem]"
          style={{ "--d": "60ms" } as React.CSSProperties}
        >
          {outcome.message}
        </h1>

        <p
          className="animate-rise stagger mt-6 text-lg text-[var(--text-soft)] text-pretty"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          Kommen Sie gern zum Empfang — wir helfen sofort weiter.
        </p>

        <div
          className="animate-rise stagger mt-10 flex flex-wrap gap-3"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          {manualSearch ? (
            <Button size="lg" onClick={onSearch}>
              Mit Namen suchen
            </Button>
          ) : null}
          <Button variant="outline" size="lg" onClick={onReset}>
            Noch einmal scannen
          </Button>
        </div>
      </div>
    </div>
  );
}

function SearchPanel({
  query,
  onQuery,
  results,
  hint,
  busy,
  onPick,
  onBack,
  labels,
}: {
  query: string;
  onQuery: (value: string) => void;
  results: SearchResult[];
  hint: string | null;
  busy: boolean;
  onPick: (id: string) => void;
  onBack: () => void;
  labels: SearchLabels;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return (
    <div className="animate-rise w-full max-w-xl">
      <p className="label">Anmeldung suchen</p>

      <h1 className="mt-5 text-[2rem] leading-[1.05] font-medium tracking-[-0.035em] text-balance sm:text-[2.75rem]">
        Anmeldung finden
      </h1>
      <p className="mt-4 text-[var(--text-soft)] text-pretty">{labels.help}</p>

      <Input
        ref={inputRef}
        value={query}
        onChange={(event) => onQuery(event.target.value)}
        placeholder={labels.placeholder}
        autoComplete="off"
        autoCapitalize="none"
        spellCheck={false}
        className="mt-8 h-16 px-4 text-xl"
        aria-label={labels.label}
      />

      {results.length > 0 ? (
        <ul className="mt-6 border-t border-[var(--line)]">
          {results.map((result, i) => (
            <li key={result.id} className="border-b border-[var(--line)]">
              <button
                disabled={busy}
                onClick={() => onPick(result.id)}
                style={{ "--d": `${i * 50}ms` } as React.CSSProperties}
                className="animate-rise stagger flex w-full items-center justify-between gap-4 py-4 text-left transition-colors hover:bg-[var(--page-sunk)] disabled:opacity-40"
              >
                <span className="min-w-0">
                  <span className="block truncate text-lg">{result.name}</span>
                  <span className="block truncate text-sm text-[var(--text-faint)]">
                    {[result.organization, result.email].filter(Boolean).join(" · ") || "—"}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-[var(--color-accent)]">
                  {result.alreadyCheckedIn ? "Wiedereintritt" : "Das bin ich"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {hint ? <p className="mt-5 text-sm text-[var(--text-faint)]">{hint}</p> : null}

      <button
        onClick={onBack}
        className="mt-10 text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
      >
        ← Zurück zum Scannen
      </button>
    </div>
  );
}
