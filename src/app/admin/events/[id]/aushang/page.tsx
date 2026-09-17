import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { GuestFlowWordmark } from "@/components/brand";
import { baseUrl, qrSvg } from "@/lib/qr";
import { selfCheckinUrl } from "@/lib/self-service";
import { formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Aushang" };

/**
 * Druckvorlage A4 hochkant. Schwarz auf Weiß, eine Haarlinie als Gliederung,
 * der Code trägt die Fläche. Auf dem Aushang ist Platz für die NFC-Plakette
 * vorgesehen — beide Wege stehen direkt nebeneinander.
 */
export default async function PosterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const url = selfCheckinUrl(await baseUrl(), event, "qr");
  const qr = await qrSvg(url, { margin: 0, dark: "#000000" });

  return (
    <div className="min-h-dvh bg-neutral-200 py-8 print:bg-white print:py-0">
      <style>{`@page { size: A4 portrait; margin: 0; }`}</style>

      <div className="mx-auto flex h-[297mm] w-[210mm] flex-col bg-white px-[22mm] py-[24mm] text-black">
        <header className="flex items-baseline justify-between border-b border-black pb-[5mm]">
          <p className="text-[10pt] font-medium tracking-[0.2em] uppercase">Check-in</p>
          <GuestFlowWordmark className="text-[9pt] tracking-[0.14em] text-neutral-400 uppercase" />
        </header>

        <h1 className="mt-[10mm] text-[32pt] leading-[1.03] font-medium tracking-[-0.035em] text-balance">
          {event.name}
        </h1>

        <p className="mt-[4mm] text-[12pt] text-neutral-600">
          {formatDate(event.startsAt)} · ab {formatTime(event.startsAt)} Uhr
          {event.location ? ` · ${event.location}` : ""}
        </p>

        <div className="mt-[14mm] flex flex-1 flex-col items-center justify-center">
          <div
            className="w-[95mm] [&_svg]:h-full [&_svg]:w-full"
            dangerouslySetInnerHTML={{ __html: qr }}
          />

          <p className="mt-[10mm] text-center text-[18pt] leading-tight font-medium tracking-[-0.02em] text-balance">
            Mit dem Telefon scannen und anmelden
          </p>

          <ol className="mt-[8mm] w-full max-w-[110mm] divide-y divide-neutral-300 border-y border-neutral-300">
            {[
              "Kamera öffnen und auf den Code halten",
              "Nachname oder E-Mail aus der Anmeldung eingeben",
              "Fertig — der Nachweis bleibt auf Ihrem Telefon",
            ].map((step, i) => (
              <li key={step} className="flex gap-[6mm] py-[3mm] text-[11.5pt]">
                <span className="w-[8mm] shrink-0 text-neutral-400 tabular-nums">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span>{step}</span>
              </li>
            ))}
          </ol>
        </div>

        <footer className="mt-auto border-t border-black pt-[5mm]">
          <div className="flex items-start justify-between gap-[10mm]">
            <p className="text-[9.5pt] leading-relaxed text-neutral-600">
              Kein Telefon dabei oder es klappt nicht? Bitte am Empfang melden — wir checken Sie
              direkt ein.
            </p>

            {/* Platzhalter für die NFC-Plakette: hier wird sie aufgeklebt. */}
            <div className="flex w-[42mm] shrink-0 flex-col items-center border border-dashed border-neutral-400 px-[3mm] py-[4mm] text-center">
              <span className="text-[7.5pt] font-medium tracking-[0.14em] uppercase">
                NFC-Plakette
              </span>
              <span className="mt-[2mm] text-[8pt] leading-snug text-neutral-500">
                hier aufkleben — Telefon antippen genügt
              </span>
            </div>
          </div>
        </footer>
      </div>

      <p className="no-print mx-auto mt-6 max-w-[210mm] px-4 text-center text-sm text-neutral-600">
        Zum Drucken Strg/Cmd + P · A4 hochkant · Ränder auf „keine" stellen.
      </p>
    </div>
  );
}
