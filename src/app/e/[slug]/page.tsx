import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { GuestFlowLogo } from "@/components/brand";
import { SelfCheckinClient } from "@/components/self-checkin-client";
import { displayName, getEventBySlug } from "@/lib/checkin";
import { hasEventAccess, readPass } from "@/lib/self-service";
import { formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const event = await getEventBySlug(slug).catch(() => undefined);
  return { title: event ? `Anmelden — ${event.name}` : "Anmelden" };
}

export default async function SelfCheckinPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ k?: string; m?: string }>;
}) {
  const [{ slug }, { m }] = await Promise.all([params, searchParams]);
  // Die NFC-Plakette hängt ein "m=nfc" an — sonst ist der Ablauf identisch.
  const channel = m === "nfc" ? ("nfc" as const) : ("qr" as const);
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) notFound();

  // Den Schlüssel hat die Middleware bereits ins Cookie gelegt; hier wird er
  // gegen den Wert in der Datenbank geprüft.
  const allowed = await hasEventAccess(event);

  if (!allowed || !event.selfServiceEnabled) {
    return <AccessHint eventName={event.name} disabled={!event.selfServiceEnabled} />;
  }

  // Bereits angemeldet? Dann direkt den Ausweis zeigen statt erneut zu suchen.
  const pass = await readPass(event);
  const known = pass
    ? await db.query.guests.findFirst({
        where: and(eq(guests.eventId, event.id), eq(guests.passToken, pass)),
      })
    : null;

  return (
    <main className="min-h-dvh">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col px-5 py-6">
        <header className="animate-fade-in">
          <GuestFlowLogo size="sm" />
        </header>

        <div className="animate-rise mt-10">
          <p className="label">{formatDate(event.startsAt)}</p>
          <h1 className="mt-4 text-[1.75rem] leading-[1.1] font-medium tracking-[-0.03em] text-balance">
            {event.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--text-faint)]">
            ab {formatTime(event.startsAt)} Uhr{event.location ? ` · ${event.location}` : ""}
          </p>
        </div>

        <SelfCheckinClient
          slug={event.slug}
          channel={channel}
          returning={
            known
              ? {
                  name: displayName(known),
                  organization: known.organization,
                  entryCount: known.entryCount,
                  hasSupportNeeds: Boolean(known.supportNeeds),
                }
              : null
          }
        />

        <footer className="mt-auto border-t border-[var(--line)] pt-5">
          <p className="text-[11px] leading-relaxed text-[var(--text-faint)]">
            Ihre Daten stammen aus Ihrer Anmeldung und bleiben auf dem Server der Veranstaltung.
            Nach der Veranstaltung werden sie gelöscht.
          </p>
        </footer>
      </div>
    </main>
  );
}

function AccessHint({ eventName, disabled }: { eventName: string; disabled: boolean }) {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="animate-rise max-w-sm text-center">
        <GuestFlowLogo size="lg" className="mb-8" />
        <h1 className="text-2xl font-medium tracking-[-0.03em] text-balance">{eventName}</h1>
        <p className="mt-3 text-[var(--text-soft)] text-pretty">
          {disabled
            ? "Die Anmeldung per Handy ist für diese Veranstaltung nicht aktiv. Bitte am Empfang melden."
            : "Bitte scannen Sie den QR-Code am Eingang, um sich anzumelden."}
        </p>
      </div>
    </main>
  );
}
