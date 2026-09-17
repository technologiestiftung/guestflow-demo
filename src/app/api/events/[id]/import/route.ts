import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { parseGuestList } from "@/lib/csv";

// Gästelisten sind Text; 8 MB reichen für weit über 20.000 Zeilen.
const MAX_BYTES = 8 * 1024 * 1024;

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return fail("Veranstaltung nicht gefunden.", 404);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return fail("Keine Datei übermittelt.");
  if (file.size > MAX_BYTES) return fail("Datei ist zu groß (max. 8 MB).", 413);

  const text = await file.text();
  const parsed = parseGuestList(text);

  if (parsed.rows.length === 0) {
    return fail(
      "Keine verwertbaren Zeilen gefunden. Erwartet werden Spalten wie Vorname, Nachname und Ticketcode.",
    );
  }
  if (parsed.mapping.lastName === undefined && parsed.mapping.firstName === undefined) {
    return fail("Es wurde keine Namensspalte erkannt.");
  }

  // Upsert: ein erneuter Import aktualisiert Stammdaten, ohne Anwesenheit zu verlieren.
  const CHUNK = 500;
  let processed = 0;
  for (let i = 0; i < parsed.rows.length; i += CHUNK) {
    const chunk = parsed.rows.slice(i, i + CHUNK).map((row) => ({ ...row, eventId: event.id }));
    await db
      .insert(guests)
      .values(chunk)
      .onConflictDoUpdate({
        target: [guests.eventId, guests.ticketCode],
        set: {
          firstName: sql`excluded.first_name`,
          lastName: sql`excluded.last_name`,
          email: sql`excluded.email`,
          organization: sql`excluded.organization`,
          source: sql`excluded.source`,
          supportNeeds: sql`excluded.support_needs`,
          ticketType: sql`excluded.ticket_type`,
          notes: sql`excluded.notes`,
        },
      });
    processed += chunk.length;
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(guests)
    .where(eq(guests.eventId, event.id));

  return json({
    imported: processed,
    totalGuests: total,
    skipped: parsed.skipped.slice(0, 20),
    skippedCount: parsed.skipped.length,
    recognizedColumns: Object.keys(parsed.mapping),
    headers: parsed.headers,
  });
}
