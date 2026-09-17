"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { SectionHead, Spinner } from "@/components/ui";
import { cn } from "@/lib/utils";

type Channel = "qr" | "nfc";

/**
 * Aushang-QR und NFC-Plakette tragen dieselbe Adresse — nur der Kanalparameter
 * unterscheidet sich. Beide Wege führen zur selben Selbstanmeldung, deshalb
 * stehen sie hier nebeneinander statt in getrennten Bereichen.
 */
export function AccessPanel({
  eventId,
  svg,
  qrUrl,
  nfcUrl,
  enabled,
}: {
  eventId: string;
  svg: string;
  qrUrl: string;
  nfcUrl: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [channel, setChannel] = useState<Channel>("qr");
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const url = channel === "qr" ? qrUrl : nfcUrl;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* Ohne Zwischenablage-Rechte bleibt der Link ablesbar. */
    }
  }

  async function rotate() {
    if (
      !confirm(
        "Neuen Schlüssel erzeugen?\n\nAlle gedruckten Aushänge und beschriebenen NFC-Plaketten funktionieren danach nicht mehr und müssen neu erstellt werden.",
      )
    )
      return;

    setBusy(true);
    await fetch(`/api/events/${eventId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rotateToken: true }),
    }).catch(() => null);
    setBusy(false);
    router.refresh();
  }

  return (
    <section>
      <SectionHead
        action={
          !enabled ? (
            <span className="text-[0.6875rem] tracking-[0.06em] text-[var(--color-signal)] uppercase">
              deaktiviert
            </span>
          ) : null
        }
      >
        Zugang am Eingang
      </SectionHead>

      <div className="-mb-px mt-5 flex border-b border-[var(--line)]">
        {(
          [
            { key: "qr", label: "QR-Aushang" },
            { key: "nfc", label: "NFC-Plakette" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setChannel(tab.key)}
            className={cn(
              "border-b-2 px-3.5 pb-2.5 text-sm transition-colors",
              channel === tab.key
                ? "border-[var(--text)] text-[var(--text)]"
                : "border-transparent text-[var(--text-faint)] hover:text-[var(--text)]",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {channel === "qr" ? (
          <QrTab eventId={eventId} svg={svg} />
        ) : (
          <NfcTab url={nfcUrl} />
        )}
      </div>

      <div className="mt-6 border-t border-[var(--line)] pt-4">
        <p className="label">Adresse hinter {channel === "qr" ? "dem Code" : "der Plakette"}</p>
        <p className="mt-2 truncate border border-[var(--line)] bg-[var(--page-sunk)] px-3 py-2 font-mono text-xs text-[var(--text-soft)]">
          {url}
        </p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={copyLink}
            className="border border-[var(--line-strong)] px-3 py-1.5 text-[0.8125rem] transition-colors hover:border-[var(--text)]"
          >
            {copied ? "Kopiert" : "Adresse kopieren"}
          </button>
          <button
            onClick={rotate}
            disabled={busy}
            className="px-3 py-1.5 text-[0.8125rem] text-[var(--text-faint)] transition-colors hover:text-[var(--text)] disabled:opacity-40"
          >
            Schlüssel erneuern
          </button>
        </div>

        <p className="mt-3 text-xs leading-relaxed text-[var(--text-faint)]">
          Die Adresse enthält einen Zugangsschlüssel. Sie gehört an den Veranstaltungsort und nicht
          in öffentliche Kanäle.
        </p>
      </div>
    </section>
  );
}

function QrTab({ eventId, svg }: { eventId: string; svg: string }) {
  return (
    <div className="flex flex-wrap items-start gap-6">
      <div
        className="w-32 shrink-0 border border-[var(--line-strong)] bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-[var(--text-soft)]">
          Am Eingang aufhängen. Gäste scannen mit der Kamera ihres Telefons und melden sich selbst
          an — ohne App, ohne Personal.
        </p>

        <a
          href={`/admin/events/${eventId}/aushang`}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex border border-[var(--text)] bg-[var(--text)] px-3.5 py-2 text-[0.8125rem] text-[var(--page)] transition-colors hover:bg-[var(--color-accent)] hover:border-[var(--color-accent)]"
        >
          Aushang drucken (A4)
        </a>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------------
   NFC: eine Plakette am Eingang, die Gäste mit dem Telefon berühren.
   Auf Android kann der Tag direkt aus dem Browser beschrieben werden
   (Web NFC, nur Chrome über HTTPS). Sonst gibt es die Anleitung für eine
   App wie „NFC Tools".
   --------------------------------------------------------------------------- */

type WriteState = "idle" | "unsupported" | "waiting" | "done" | "error";

// Web NFC ist noch nicht in den Standard-Typdefinitionen enthalten.
type NdefWriter = { write: (message: { records: { recordType: string; data: string }[] }) => Promise<void> };

function NfcTab({ url }: { url: string }) {
  const [state, setState] = useState<WriteState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && !("NDEFReader" in window)) setState("unsupported");
  }, []);

  async function writeTag() {
    setError(null);
    const Ctor = (window as unknown as { NDEFReader?: new () => NdefWriter }).NDEFReader;
    if (!Ctor) {
      setState("unsupported");
      return;
    }

    setState("waiting");
    try {
      const writer = new Ctor();
      // Ein einzelner URL-Datensatz reicht: Telefone öffnen ihn beim Auflegen.
      await writer.write({ records: [{ recordType: "url", data: url }] });
      setState("done");
    } catch (cause) {
      setState("error");
      setError(
        cause instanceof Error && cause.name === "NotAllowedError"
          ? "Zugriff auf NFC wurde abgelehnt oder es wurde zu lange gewartet."
          : "Der Tag konnte nicht beschrieben werden. Bitte erneut auflegen.",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div className="grid h-32 w-32 shrink-0 place-items-center border border-[var(--line-strong)]">
        <svg
          viewBox="0 0 48 48"
          className={cn(
            "h-12 w-12 transition-colors",
            state === "waiting" ? "text-[var(--color-accent)]" : "text-[var(--text-faint)]",
          )}
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="square"
        >
          {/* Drei Wellen plus Telefonkante — das gängige NFC-Sinnbild, kantig gesetzt. */}
          <path d="M14 6h10v36H14z" />
          <path d="M30 17c3 2 3 12 0 14" className={cn(state === "waiting" && "animate-tick")} />
          <path d="M35 12c6 4 6 20 0 24" className={cn(state === "waiting" && "animate-tick")} />
        </svg>
      </div>

      <div className="min-w-0 flex-1">
        <p className="text-sm leading-relaxed text-[var(--text-soft)]">
          Eine NFC-Plakette am Eingang: Gäste halten das Telefon daran, die Anmeldeseite öffnet sich
          von selbst. Kein Scannen, kein Zielen — besonders hilfreich bei Dunkelheit oder mit vollen
          Händen.
        </p>

        {state === "unsupported" ? (
          <div className="mt-4 border-l-2 border-[var(--line-strong)] pl-3">
            <p className="text-sm text-[var(--text-soft)]">
              Dieser Browser kann keine Tags beschreiben. So geht es trotzdem:
            </p>
            <ol className="mt-2 space-y-1 text-sm text-[var(--text-faint)]">
              <li>1. Adresse unten kopieren.</li>
              <li>2. Auf einem Android-Telefon die App „NFC Tools“ öffnen.</li>
              <li>3. Schreiben → Datensatz hinzufügen → URL → Adresse einfügen.</li>
              <li>4. Tag auflegen und schreiben. Danach schreibgeschützt setzen.</li>
            </ol>
          </div>
        ) : (
          <>
            <button
              onClick={writeTag}
              disabled={state === "waiting"}
              className="mt-4 inline-flex items-center gap-2 border border-[var(--text)] bg-[var(--text)] px-3.5 py-2 text-[0.8125rem] text-[var(--page)] transition-colors hover:bg-[var(--color-accent)] hover:border-[var(--color-accent)] disabled:opacity-50"
            >
              {state === "waiting" ? (
                <>
                  <Spinner className="border-[var(--page)] border-t-transparent" />
                  Tag auflegen…
                </>
              ) : (
                "NFC-Tag beschreiben"
              )}
            </button>

            {state === "done" ? (
              <p className="animate-fade mt-3 text-sm text-[var(--color-accent)]">
                Tag beschrieben. Zum Prüfen einmal mit einem anderen Telefon auflegen.
              </p>
            ) : null}
            {error ? (
              <p className="animate-fade mt-3 text-sm text-[var(--color-alert)]">{error}</p>
            ) : null}
          </>
        )}

        <p className="mt-4 text-xs leading-relaxed text-[var(--text-faint)]">
          Geeignet sind NTAG213 oder größer. Nach dem Beschreiben schreibschützen, damit die
          Plakette vor Ort nicht verändert werden kann.
        </p>
      </div>
    </div>
  );
}
