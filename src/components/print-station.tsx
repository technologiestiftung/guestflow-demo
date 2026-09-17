"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Dot, SectionHead } from "@/components/ui";
import { cn, formatTime } from "@/lib/utils";

type Pending = {
  id: string;
  firstName: string;
  lastName: string;
  organization: string | null;
  checkedInAt: string | null;
};

type Printed = { id: string; name: string; at: number };

const POLL_MS = 4000;
// Abstand zwischen zwei Druckaufträgen: der Browser-Druckdialog braucht Luft.
const PRINT_SPACING_MS = 2500;

export function PrintStation({ eventId, eventName }: { eventId: string; eventName: string }) {
  const [armed, setArmed] = useState(false);
  const [queue, setQueue] = useState<Pending[]>([]);
  const [printed, setPrinted] = useState<Printed[]>([]);
  const [online, setOnline] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Was gedruckt wurde, darf nicht erneut in die Warteschlange rutschen,
  // solange der Server den Vermerk noch nicht zurückgemeldet hat.
  const handledRef = useRef<Set<string>>(new Set());
  const printingRef = useRef(false);

  const print = useCallback(async (guest: Pending) => {
    const name = [guest.firstName, guest.lastName].filter(Boolean).join(" ");
    handledRef.current.add(guest.id);
    setBusyId(guest.id);

    await new Promise<void>((resolve) => {
      const previous = document.getElementById("badge-frame");
      previous?.remove();

      const frame = document.createElement("iframe");
      frame.id = "badge-frame";
      frame.style.cssText = "position:fixed;width:0;height:0;border:0;visibility:hidden;";
      frame.src = `/badge/${guest.id}`;
      frame.onload = () => {
        try {
          frame.contentWindow?.focus();
          frame.contentWindow?.print();
        } catch {
          /* Ohne Drucker bleibt der Check-in trotzdem gültig. */
        }
        resolve();
      };
      // Falls die Seite nicht lädt, nicht ewig blockieren.
      setTimeout(resolve, 6000);
      document.body.appendChild(frame);
    });

    await fetch(`/api/events/${eventId}/guests/${guest.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "badge_printed" }),
    }).catch(() => null);

    setPrinted((prev) => [{ id: guest.id, name, at: Date.now() }, ...prev].slice(0, 20));
    setQueue((prev) => prev.filter((entry) => entry.id !== guest.id));
    setBusyId(null);
  }, [eventId]);

  // Warteschlange abfragen
  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const response = await fetch(`/api/events/${eventId}/print-queue`, { cache: "no-store" });
        if (!response.ok) throw new Error();
        const data = await response.json();
        if (cancelled) return;
        setOnline(true);
        setQueue(
          (data.pending as Pending[]).filter((guest) => !handledRef.current.has(guest.id)),
        );
      } catch {
        if (!cancelled) setOnline(false);
      }
    }

    poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [eventId]);

  // Automatisch drucken, einer nach dem anderen
  useEffect(() => {
    if (!armed || printingRef.current || queue.length === 0) return;

    printingRef.current = true;
    const next = queue[0];
    print(next).finally(() => {
      setTimeout(() => {
        printingRef.current = false;
      }, PRINT_SPACING_MS);
    });
  }, [armed, queue, print]);

  return (
    <div className="mt-10 space-y-12">
      <section className="border-y border-[var(--line)] py-6">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Dot tone={armed ? "accent" : "faint"} pulse={armed} className="h-2 w-2" />
            <div>
              <p className="font-medium">
                {armed ? "Druck läuft automatisch" : "Druck pausiert"}
              </p>
              <p className="mt-0.5 text-sm text-[var(--text-faint)]">
                {online ? `${queue.length} in der Warteschlange` : "keine Verbindung zum Server"}
              </p>
            </div>
          </div>

          <Button
            size="lg"
            variant={armed ? "outline" : "primary"}
            onClick={() => setArmed((value) => !value)}
          >
            {armed ? "Pausieren" : "Automatik starten"}
          </Button>
        </div>

        {!armed ? (
          <div className="mt-6 border-l-2 border-[var(--line-strong)] pl-4">
            <p className="label">Drucker einrichten</p>
            <ol className="mt-3 space-y-1.5 text-sm text-[var(--text-soft)]">
              <li>01 — Etikettendrucker als Standarddrucker dieses Rechners festlegen.</li>
              <li>02 — Papierformat auf 90 × 54 mm stellen, Ränder auf „keine".</li>
              <li>
                03 — Im Browser „ohne Dialog drucken" aktivieren, sonst wird jeder Ausdruck von
                Hand bestätigt.
              </li>
              <li>04 — Ein Testschild drucken, dann Automatik starten.</li>
            </ol>
            <p className="mt-3 text-xs text-[var(--text-faint)]">
              Ohne stillen Druck funktioniert alles trotzdem — der Dialog geht dann pro Gast einmal
              auf.
            </p>
          </div>
        ) : null}
      </section>

      <section>
        <SectionHead>Warteschlange</SectionHead>

        {queue.length === 0 ? (
          <p className="py-10 text-sm text-[var(--text-faint)]">
            Nichts zu drucken. Sobald jemand eincheckt, erscheint das Schild hier.
          </p>
        ) : (
          <ul className="divide-y divide-[var(--line)]">
            {queue.map((guest, i) => (
              <li
                key={guest.id}
                style={{ "--d": `${i * 45}ms` } as React.CSSProperties}
                className="animate-rise stagger flex items-center justify-between gap-4 py-3.5"
              >
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">
                    {guest.firstName} {guest.lastName}
                  </span>
                  <span className="block truncate text-xs text-[var(--text-faint)]">
                    {guest.organization ?? "—"} · eingecheckt {formatTime(guest.checkedInAt)}
                  </span>
                </span>

                <button
                  onClick={() => print(guest)}
                  disabled={busyId === guest.id}
                  className="shrink-0 border border-[var(--line-strong)] px-2.5 py-1 text-xs transition-colors hover:border-[var(--text)] disabled:opacity-40"
                >
                  {busyId === guest.id ? "druckt…" : "jetzt drucken"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {printed.length > 0 ? (
        <section>
          <SectionHead>Zuletzt gedruckt</SectionHead>
          <ul className="divide-y divide-[var(--line)]">
            {printed.map((entry) => (
              <li
                key={`${entry.id}-${entry.at}`}
                className="animate-fade flex justify-between py-2.5 text-sm"
              >
                <span className="text-[var(--text-soft)]">{entry.name}</span>
                <span className="num text-[var(--text-faint)]">
                  {new Date(entry.at).toLocaleTimeString("de-DE", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <p className="border-t border-[var(--line)] pt-5 text-xs text-[var(--text-faint)]">
        Veranstaltung: {eventName}. Diese Seite geöffnet lassen, solange gedruckt werden soll.
      </p>
    </div>
  );
}
