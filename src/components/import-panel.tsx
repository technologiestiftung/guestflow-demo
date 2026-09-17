"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { SectionHead, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type ImportResult = {
  imported: number;
  totalGuests: number;
  skipped: { line: number; reason: string }[];
  skippedCount: number;
  recognizedColumns: string[];
  headers: string[];
};

const COLUMN_LABELS: Record<string, string> = {
  ticketCode: "Ticketcode",
  firstName: "Vorname",
  lastName: "Nachname",
  email: "E-Mail",
  organization: "Organisation",
  source: "Quelle",
  supportNeeds: "Unterstützungsbedarf",
  ticketType: "Tickettyp",
  notes: "Notiz",
};

export function ImportPanel({ eventId, guestCount }: { eventId: string; guestCount: number }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const response = await fetch(`/api/events/${eventId}/import`, { method: "POST", body: form });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Der Import ist fehlgeschlagen.");
        return;
      }
      setResult(data);
      router.refresh();
    } catch {
      setError("Keine Verbindung zum Server.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <section>
      <SectionHead
        action={
          guestCount > 0 ? (
            <span className="num text-[0.8125rem] text-[var(--text-faint)]">
              {guestCount} Gäste
            </span>
          ) : null
        }
      >
        Gästeliste aus Doo
      </SectionHead>

      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) upload(file);
        }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
        }}
        className={cn(
          "mt-5 cursor-pointer border border-dashed px-6 py-10 text-center transition-colors duration-150",
          dragging
            ? "border-[var(--color-accent)] bg-[var(--page-sunk)]"
            : "border-[var(--line-strong)] hover:border-[var(--text)]",
          busy && "pointer-events-none opacity-50",
        )}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv,text/plain"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) upload(file);
          }}
        />

        {busy ? (
          <span className="flex flex-col items-center gap-3">
            <Spinner />
            <span className="label">Datei wird gelesen</span>
          </span>
        ) : (
          <>
            <p className="font-medium">CSV hierher ziehen</p>
            <p className="mt-1.5 text-sm text-[var(--text-faint)]">
              oder klicken, um eine Datei zu wählen
            </p>
          </>
        )}
      </div>

      {error ? (
        <p className="animate-fade mt-5 border-l-2 border-[var(--color-alert)] pl-3 text-sm text-[var(--color-alert)]">
          {error}
        </p>
      ) : null}

      {result ? (
        <div className="animate-rise mt-5 border-l-2 border-[var(--color-accent)] pl-4">
          <p className="text-sm">
            {result.imported} Zeilen übernommen — die Liste umfasst jetzt{" "}
            <span className="num">{result.totalGuests}</span> Gäste.
          </p>

          <p className="label mt-4">Erkannte Spalten</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {result.recognizedColumns.map((column) => (
              <span
                key={column}
                className="border border-[var(--line-strong)] px-2 py-0.5 text-xs text-[var(--text-soft)]"
              >
                {COLUMN_LABELS[column] ?? column}
              </span>
            ))}
          </div>

          {result.skippedCount > 0 ? (
            <details className="mt-4">
              <summary className="cursor-pointer text-xs text-[var(--color-signal)]">
                {result.skippedCount} Zeilen übersprungen
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-[var(--text-faint)]">
                {result.skipped.map((entry) => (
                  <li key={entry.line}>
                    Zeile {entry.line}: {entry.reason}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}

      <p className="mt-5 text-xs leading-relaxed text-[var(--text-faint)]">
        Spalten werden automatisch erkannt (Vorname, Nachname, E-Mail, Organisation, Ticketcode,
        Unterstützungsbedarf …). Semikolon und Komma funktionieren beide. Ein erneuter Import
        aktualisiert Stammdaten, ohne erfasste Anwesenheiten zu verlieren.
      </p>
    </section>
  );
}
