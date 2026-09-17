import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { Badge, EmptyState, SectionHead } from "@/components/ui";
import { CreateEventForm } from "@/components/create-event-form";
import { formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Veranstaltungen" };

/** Läuft gerade? Einlass beginnt erfahrungsgemäß eine Stunde vor Beginn. */
function isLive(startsAt: Date, endsAt: Date | null) {
  const now = Date.now();
  const start = new Date(startsAt).getTime();
  const end = endsAt ? new Date(endsAt).getTime() : start + 6 * 60 * 60 * 1000;
  return now >= start - 60 * 60 * 1000 && now <= end;
}

export default async function AdminDashboard() {
  const rows = await db
    .select({
      event: events,
      total: sql<number>`count(${guests.id})::int`,
      present: sql<number>`count(${guests.id}) filter (where ${guests.checkedInAt} is not null)::int`,
    })
    .from(events)
    .leftJoin(guests, eq(guests.eventId, events.id))
    .groupBy(events.id)
    .orderBy(desc(events.startsAt));

  const live = rows.filter((row) => !row.event.archivedAt && isLive(row.event.startsAt, row.event.endsAt));
  const rest = rows.filter((row) => !live.includes(row));

  return (
    <main className="mx-auto max-w-6xl px-6 py-12">
      <div className="animate-rise">
        <h1 className="text-[2rem] font-medium tracking-[-0.035em]">Veranstaltungen</h1>
        <p className="mt-2 text-[var(--text-soft)]">
          Gästeliste importieren, Zugang am Eingang einrichten, Anwesenheit verfolgen.
        </p>
      </div>

      <div className="mt-12 grid gap-12 lg:grid-cols-[1fr_20rem]">
        <div className="order-2 space-y-12 lg:order-1">
          {/* Was gerade läuft, steht oben und ist als Einziges hervorgehoben. */}
          {live.length > 0 ? (
            <section>
              <SectionHead>Läuft gerade</SectionHead>
              <ul className="mt-2">
                {live.map((row, i) => (
                  <EventRow key={row.event.id} {...row} index={i} highlighted />
                ))}
              </ul>
            </section>
          ) : null}

          <section>
            <SectionHead>{live.length > 0 ? "Weitere" : "Alle Veranstaltungen"}</SectionHead>

            {rest.length === 0 ? (
              live.length > 0 ? (
                <p className="py-8 text-sm text-[var(--text-faint)]">Keine weiteren Einträge.</p>
              ) : (
                <div className="mt-6">
                  <EmptyState
                    title="Noch keine Veranstaltung"
                    description="Rechts die erste Veranstaltung anlegen. Danach die Gästeliste aus Doo als CSV importieren."
                  />
                </div>
              )
            ) : (
              <ul className="mt-2">
                {rest.map((row, i) => (
                  <EventRow key={row.event.id} {...row} index={i} />
                ))}
              </ul>
            )}
          </section>
        </div>

        <aside className="order-1 lg:order-2">
          <div className="lg:sticky lg:top-20">
            <SectionHead>Neue Veranstaltung</SectionHead>
            <CreateEventForm />

            <div className="mt-12 border-t border-[var(--line)] pt-6">
              <p className="label">Drei Wege zum Check-in</p>
              <ol className="mt-4 space-y-4 text-sm">
                {[
                  ["NFC-Plakette", "Telefon antippen. Kein Zielen, kein Scannen."],
                  ["QR-Aushang", "Mit der Kamera scannen. Funktioniert auf jedem Telefon."],
                  ["Kiosk am Tablet", "Für Gäste ohne Smartphone — das Tablet scannt das Ticket."],
                ].map(([title, body], i) => (
                  <li key={title} className="flex gap-3">
                    <span className="num shrink-0 text-xs text-[var(--color-accent)]">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <span>
                      <span className="block font-medium">{title}</span>
                      <span className="block text-[var(--text-faint)]">{body}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </aside>
      </div>
    </main>
  );
}

function EventRow({
  event,
  total,
  present,
  index,
  highlighted = false,
}: {
  event: typeof events.$inferSelect;
  total: number;
  present: number;
  index: number;
  highlighted?: boolean;
}) {
  const quota = total > 0 ? Math.round((present / total) * 100) : 0;

  return (
    <li
      style={{ "--d": `${index * 50}ms` } as React.CSSProperties}
      className="animate-rise stagger border-b border-[var(--line)]"
    >
      <Link
        href={`/admin/events/${event.id}`}
        className="group flex flex-wrap items-center gap-x-6 gap-y-3 py-5 transition-colors hover:bg-[var(--page-sunk)]"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-medium">{event.name}</span>
            {highlighted ? <Badge tone="solid">live</Badge> : null}
            {event.archivedAt ? <Badge>archiviert</Badge> : null}
          </span>
          <span className="mt-1 block text-sm text-[var(--text-faint)]">
            {formatDate(event.startsAt)} · {formatTime(event.startsAt)} Uhr
            {event.location ? ` · ${event.location}` : ""}
          </span>
        </span>

        <span className="flex items-center gap-5">
          {/* Fortschritt als schmaler Balken statt als Kreis oder Farbfläche. */}
          <span className="hidden h-1.5 w-24 border border-[var(--line-strong)] sm:block">
            <span
              className="block h-full bg-[var(--text)] transition-[width] duration-500"
              style={{ width: `${quota}%` }}
            />
          </span>

          <span className="num w-20 text-right">
            <span className="text-lg font-medium">{present}</span>
            <span className="text-[var(--text-faint)]"> / {total}</span>
            <span className="label mt-0.5 block text-right">anwesend</span>
          </span>
        </span>
      </Link>
    </li>
  );
}
