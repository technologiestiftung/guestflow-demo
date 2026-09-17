import Link from "next/link";
import { eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { events } from "@/db/schema";
import { PrintStation } from "@/components/print-station";

export const dynamic = "force-dynamic";
export const metadata = { title: "Druckstation" };

export default async function PrintStationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <Link
        href={`/admin/events/${event.id}`}
        className="text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
      >
        ← Zurück zur Veranstaltung
      </Link>

      <h1 className="animate-rise mt-6 text-[2rem] font-medium tracking-[-0.035em]">
        Druckstation
      </h1>
      <p className="animate-rise mt-2 max-w-xl text-[var(--text-soft)] text-pretty">
        Diese Seite auf dem Rechner öffnen, an dem der Etikettendrucker hängt. Sobald jemand
        eincheckt, wird das Namensschild gedruckt — egal ob per Handy, am Kiosk oder durch das Team.
      </p>

      <PrintStation eventId={event.id} eventName={event.name} />
    </main>
  );
}
