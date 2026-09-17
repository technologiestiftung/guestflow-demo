import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { fail, requireAdmin } from "@/lib/api";
import { toCsv } from "@/lib/csv";
import { formatDateTime, slugify } from "@/lib/utils";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return fail("Veranstaltung nicht gefunden.", 404);

  const rows = await db
    .select()
    .from(guests)
    .where(eq(guests.eventId, event.id))
    .orderBy(asc(guests.lastName), asc(guests.firstName));

  const csv = toCsv(
    [
      "Nachname",
      "Vorname",
      "Organisation",
      "E-Mail",
      "Ticketcode",
      "Tickettyp",
      "Quelle",
      "Unterstützungsbedarf",
      "Anwesend",
      "Check-in",
      "Zuletzt gesehen",
      "Eintritte",
    ],
    rows.map((g) => [
      g.lastName,
      g.firstName,
      g.organization,
      g.email,
      g.ticketCode,
      g.ticketType,
      g.source,
      g.supportNeeds,
      g.checkedInAt ? "ja" : "nein",
      g.checkedInAt ? formatDateTime(g.checkedInAt) : "",
      g.lastSeenAt ? formatDateTime(g.lastSeenAt) : "",
      g.entryCount,
    ]),
  );

  const date = new Date(event.startsAt).toISOString().slice(0, 10);
  const filename = `teilnahme-${slugify(event.name) || "veranstaltung"}-${date}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      // Teilnahmelisten gehören nicht in Caches.
      "Cache-Control": "no-store",
    },
  });
}
