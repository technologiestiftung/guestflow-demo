import Link from "next/link";
import { and, asc, desc, eq, isNotNull, sql } from "drizzle-orm";
import { notFound } from "next/navigation";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { Badge, SectionHead } from "@/components/ui";
import { AccessPanel } from "@/components/access-panel";
import { ImportPanel } from "@/components/import-panel";
import { LiveBoard } from "@/components/live-board";
import { GuestTable, type GuestRow } from "@/components/guest-table";
import { DataPanel, EventSettings } from "@/components/event-settings";
import { displayName } from "@/lib/checkin";
import { baseUrl, qrSvg } from "@/lib/qr";
import { selfCheckinUrl } from "@/lib/self-service";
import { formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  return { title: event?.name ?? "Veranstaltung" };
}

/** Läuft die Veranstaltung gerade? Ohne Ende rechnen wir mit sechs Stunden. */
function activityState(startsAt: Date, endsAt: Date | null) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 6 * 60 * 60 * 1000;
  // Der Einlass beginnt erfahrungsgemäß eine Stunde vor Start.
  if (now >= start - 60 * 60 * 1000 && now <= end) return "live" as const;
  return now < start ? ("upcoming" as const) : ("past" as const);
}

export default async function EventDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) notFound();

  const [stats] = await db
    .select({
      total: sql<number>`count(*)::int`,
      present: sql<number>`count(*) filter (where ${guests.checkedInAt} is not null)::int`,
      support: sql<number>`count(*) filter (where ${guests.supportNeeds} is not null)::int`,
      supportOpen: sql<number>`count(*) filter (where ${guests.supportNeeds} is not null and ${guests.checkedInAt} is not null and ${guests.supportAckAt} is null)::int`,
      reEntries: sql<number>`coalesce(sum(greatest(${guests.entryCount} - 1, 0)), 0)::int`,
    })
    .from(guests)
    .where(eq(guests.eventId, event.id));

  const [recent, alerts, allGuests, origin] = await Promise.all([
    db
      .select()
      .from(guests)
      .where(and(eq(guests.eventId, event.id), isNotNull(guests.lastSeenAt)))
      .orderBy(desc(guests.lastSeenAt))
      .limit(12),
    db
      .select()
      .from(guests)
      .where(
        and(
          eq(guests.eventId, event.id),
          isNotNull(guests.supportNeeds),
          isNotNull(guests.checkedInAt),
          sql`${guests.supportAckAt} is null`,
        ),
      )
      .orderBy(desc(guests.checkedInAt))
      .limit(10),
    db
      .select()
      .from(guests)
      .where(eq(guests.eventId, event.id))
      .orderBy(asc(guests.lastName), asc(guests.firstName))
      .limit(2000),
    baseUrl(),
  ]);

  const qrUrl = selfCheckinUrl(origin, event, "qr");
  const nfcUrl = selfCheckinUrl(origin, event, "nfc");
  const qr = await qrSvg(qrUrl);
  const state = activityState(event.startsAt, event.endsAt);

  const rows: GuestRow[] = allGuests.map((guest) => ({
    id: guest.id,
    pin: guest.pin,
    firstName: guest.firstName,
    lastName: guest.lastName,
    organization: guest.organization,
    email: guest.email,
    supportNeeds: guest.supportNeeds,
    ticketType: guest.ticketType,
    checkedInAt: guest.checkedInAt?.toISOString() ?? null,
    lastSeenAt: guest.lastSeenAt?.toISOString() ?? null,
    entryCount: guest.entryCount,
  }));

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link
        href="/admin"
        className="text-sm text-[var(--text-faint)] transition-colors hover:text-[var(--text)]"
      >
        ← Alle Veranstaltungen
      </Link>

      <header className="animate-rise mt-6 flex flex-wrap items-start justify-between gap-6 border-b border-[var(--line)] pb-8">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[2rem] leading-tight font-medium tracking-[-0.035em] text-balance">
              {event.name}
            </h1>
            {state === "live" ? (
              <Badge tone="solid">live</Badge>
            ) : state === "upcoming" ? (
              <Badge tone="accent">bevorstehend</Badge>
            ) : (
              <Badge>beendet</Badge>
            )}
            {event.archivedAt ? <Badge>archiviert</Badge> : null}
          </div>
          <p className="mt-2 text-[var(--text-faint)]">
            {formatDate(event.startsAt)} · {formatTime(event.startsAt)} Uhr
            {event.location ? ` · ${event.location}` : ""}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/admin/events/${event.id}/drucken`}
            className="border border-[var(--line-strong)] px-4 py-2.5 text-sm transition-colors hover:border-[var(--text)]"
          >
            Druckstation
          </Link>
          <Link
            href={`/kiosk/${event.slug}`}
            target="_blank"
            rel="noreferrer"
            className="border border-[var(--text)] bg-[var(--text)] px-4 py-2.5 text-sm text-[var(--page)] transition-colors hover:bg-[var(--color-accent)] hover:border-[var(--color-accent)]"
          >
            Kiosk öffnen ↗
          </Link>
        </div>
      </header>

      <div className="mt-10">
        <LiveBoard
          eventId={event.id}
          initial={{
            stats,
            capacity: event.capacity,
            recent: recent.map((guest) => ({
              id: guest.id,
              name: displayName(guest),
              organization: guest.organization,
              lastSeenAt: guest.lastSeenAt?.toISOString() ?? null,
              entryCount: guest.entryCount,
              hasSupportNeeds: Boolean(guest.supportNeeds),
            })),
            alerts: alerts.map((guest) => ({
              id: guest.id,
              name: displayName(guest),
              organization: guest.organization,
              supportNeeds: guest.supportNeeds,
              checkedInAt: guest.checkedInAt?.toISOString() ?? null,
            })),
          }}
        />
      </div>

      <section className="mt-14">
        <SectionHead>Gästeliste</SectionHead>
        <div className="mt-6">
          <GuestTable eventId={event.id} guests={rows} lookupMode={event.lookupMode} />
        </div>
      </section>

      <div className="mt-14 grid gap-14 lg:grid-cols-2 lg:gap-x-16">
        <div className="space-y-14">
          <AccessPanel
            eventId={event.id}
            svg={qr}
            qrUrl={qrUrl}
            nfcUrl={nfcUrl}
            enabled={event.selfServiceEnabled}
          />
          <ImportPanel eventId={event.id} guestCount={stats.total} />
        </div>

        <div className="space-y-14">
          <EventSettings
            eventId={event.id}
            flags={{
              selfServiceEnabled: event.selfServiceEnabled,
              badgePrinting: event.badgePrinting,
              manualSearch: event.manualSearch,
              allowReEntry: event.allowReEntry,
            }}
            lookupMode={event.lookupMode}
          />

          <DataPanel eventId={event.id} eventName={event.name} guestCount={stats.total} />

          <section>
            <SectionHead>Ablauf am Veranstaltungstag</SectionHead>
            <ol className="mt-2 divide-y divide-[var(--line)]">
              {[
                "Gästeliste aus Doo als CSV exportieren und hier hochladen.",
                "QR-Aushang drucken und NFC-Plakette beschreiben, beides am Eingang anbringen.",
                "Optional ein Tablet mit dem Kiosk aufstellen — für Gäste ohne Smartphone.",
                "Druckstation auf dem Rechner mit dem Etikettendrucker öffnen.",
                "Diese Seite offen lassen: Ankünfte und Hinweise laufen live ein.",
                "Danach Teilnahmeliste exportieren und Gästedaten löschen.",
              ].map((step, i) => (
                <li key={step} className="flex gap-4 py-3 text-sm">
                  <span className="num shrink-0 text-xs text-[var(--text-faint)]">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span className="text-[var(--text-soft)]">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        </div>
      </div>
    </main>
  );
}
