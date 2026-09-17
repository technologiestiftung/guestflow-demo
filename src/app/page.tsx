import Link from "next/link";
import { desc, isNull } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import { GuestFlowLogo } from "@/components/brand";
import { ButtonLink, Dot, EmptyState, SectionHead } from "@/components/ui";
import { formatDate, formatTime } from "@/lib/utils";

export const dynamic = "force-dynamic";

async function loadEvents() {
  try {
    return await db.query.events.findMany({
      where: isNull(events.archivedAt),
      orderBy: [desc(events.startsAt)],
      limit: 12,
    });
  } catch {
    // Vor der ersten Migration ist das kein Fehler, den Gäste sehen müssen.
    return null;
  }
}

const STEPS = [
  {
    n: "01",
    title: "Liste importieren",
    body: "CSV-Export aus Doo hochladen. Spalten werden automatisch erkannt.",
  },
  {
    n: "02",
    title: "QR aushängen",
    body: "Ein Code am Eingang. Gäste scannen mit dem eigenen Telefon.",
  },
  {
    n: "03",
    title: "Selbst anmelden",
    body: "Name eingeben, bestätigen, fertig. Der Nachweis bleibt auf dem Telefon.",
  },
  {
    n: "04",
    title: "Live mitlesen",
    body: "Wer da ist, wer fehlt, wer Unterstützung angemeldet hat.",
  },
];

export default async function HomePage() {
  const list = await loadEvents();

  return (
    <main className="min-h-dvh">
      <header className="border-b border-[var(--line)]">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <GuestFlowLogo animated />
          <ButtonLink href="/admin" variant="outline" size="sm">
            Team-Bereich
          </ButtonLink>
        </div>
      </header>

      {/* Titelblock: große Type, viel Luft, eine Linie als Abschluss. */}
      <section className="mx-auto max-w-5xl px-6 pt-20 pb-16 sm:pt-32">
        <p className="label animate-rise">Self-Check-in für Veranstaltungen</p>

        <h1
          className="animate-rise stagger mt-7 max-w-3xl text-[2.75rem] leading-[1.02] font-medium tracking-[-0.035em] text-balance sm:text-[4.5rem]"
          style={{ "--d": "60ms" } as React.CSSProperties}
        >
          Einlass ohne Schlange,
          <br />
          <span className="text-[var(--text-faint)]">Nachweis ohne Papier.</span>
        </h1>

        <p
          className="animate-rise stagger mt-8 max-w-lg text-[1.0625rem] leading-relaxed text-[var(--text-soft)] text-pretty"
          style={{ "--d": "120ms" } as React.CSSProperties}
        >
          Gäste melden sich in wenigen Sekunden selbst an — mit dem eigenen Telefon oder am Tablet
          vor Ort. Das Team sieht in Echtzeit, wer eingetroffen ist.
        </p>

        <div
          className="animate-rise stagger mt-10 flex flex-wrap gap-3"
          style={{ "--d": "180ms" } as React.CSSProperties}
        >
          <ButtonLink href="/admin" size="lg">
            Veranstaltung einrichten
          </ButtonLink>
          <ButtonLink href="#veranstaltungen" variant="outline" size="lg">
            Laufende Veranstaltungen
          </ButtonLink>
        </div>
      </section>

      {/* Ablauf als Raster mit durchgehenden Linien — kein Kasten pro Punkt. */}
      <section className="border-y border-[var(--line)]">
        <div className="mx-auto grid max-w-5xl grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, i) => (
            <div
              key={step.n}
              style={{ "--d": `${i * 70}ms` } as React.CSSProperties}
              className="animate-rise stagger border-[var(--line)] px-6 py-8 not-last:border-b sm:not-last:border-b-0 sm:odd:border-r sm:[&:nth-child(-n+2)]:border-b lg:border-r lg:last:border-r-0 lg:[&:nth-child(-n+2)]:border-b-0"
            >
              <p className="num text-[0.8125rem] font-medium text-[var(--color-accent)]">{step.n}</p>
              <h3 className="mt-4 font-medium">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-[var(--text-soft)] text-pretty">
                {step.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section id="veranstaltungen" className="mx-auto max-w-5xl scroll-mt-6 px-6 py-16">
        <SectionHead>Veranstaltungen</SectionHead>

        <div className="mt-6">
          {list === null ? (
            <EmptyState
              title="Datenbank noch nicht eingerichtet"
              description="Migrationen ausführen mit npm run db:migrate — oder per Docker Compose starten, dort passiert das beim Hochfahren automatisch."
            />
          ) : list.length === 0 ? (
            <EmptyState
              title="Noch keine Veranstaltung angelegt"
              description="Im Team-Bereich eine Veranstaltung anlegen und die Gästeliste aus Doo importieren."
              action={
                <ButtonLink href="/admin" size="md">
                  Zum Team-Bereich
                </ButtonLink>
              }
            />
          ) : (
            <ul className="border-t border-[var(--line)]">
              {list.map((event, i) => (
                <li
                  key={event.id}
                  style={{ "--d": `${i * 50}ms` } as React.CSSProperties}
                  className="animate-rise stagger border-b border-[var(--line)]"
                >
                  <div className="group flex flex-wrap items-center gap-x-6 gap-y-3 py-5 transition-colors duration-150 hover:bg-[var(--page-sunk)]">
                    <span className="num w-28 shrink-0 pl-4 text-sm text-[var(--text-faint)]">
                      {formatDate(event.startsAt)}
                    </span>

                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{event.name}</span>
                      <span className="mt-0.5 block truncate text-sm text-[var(--text-faint)]">
                        {formatTime(event.startsAt)} Uhr
                        {event.location ? ` · ${event.location}` : ""}
                      </span>
                    </span>

                    <span className="flex shrink-0 gap-2 pr-4">
                      <Link
                        href={`/kiosk/${event.slug}`}
                        className="border border-[var(--line-strong)] px-3 py-1.5 text-[0.8125rem] transition-colors hover:border-[var(--text)]"
                      >
                        Kiosk
                      </Link>
                      <Link
                        href={`/admin/events/${event.id}`}
                        className="border border-[var(--text)] bg-[var(--text)] px-3 py-1.5 text-[0.8125rem] text-[var(--page)] transition-colors hover:bg-[var(--color-accent)] hover:border-[var(--color-accent)]"
                      >
                        Verwalten
                      </Link>
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <footer className="border-t border-[var(--line)]">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-8">
          <p className="flex items-center gap-2 text-[0.8125rem] text-[var(--text-faint)]">
            <Dot tone="faint" />
            Gästedaten bleiben auf diesem Server und werden nach der Veranstaltung gelöscht.
          </p>
          <GuestFlowLogo size="sm" className="opacity-50" />
        </div>
      </footer>
    </main>
  );
}
