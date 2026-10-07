import { eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { parseGuestList, type ImportRow } from "@/lib/csv";
import { createUniquePin } from "@/lib/pin-generator";

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

  const { rows, warnings } = await assignPins(event.id, parsed.rows);

  // Upsert: ein erneuter Import aktualisiert Stammdaten, ohne Anwesenheit zu verlieren.
  const CHUNK = 500;
  let processed = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK).map((row) => ({ ...row, eventId: event.id }));
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
          pin: sql`excluded.pin`,
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
    warnings: warnings.slice(0, 20),
    warningCount: warnings.length,
    recognizedColumns: Object.keys(parsed.mapping),
    headers: parsed.headers,
  });
}

/**
 * Vergibt jedem Gast eine PIN.
 *
 * Reihenfolge: aus der CSV, sonst die bereits vergebene, sonst eine neue. Eine
 * einmal vergebene PIN bleibt damit bestehen — sonst wuerden bereits
 * verschickte PINs durch einen zweiten Import ungueltig.
 *
 * PINs werden immer vergeben, auch wenn die Veranstaltung gerade einen anderen
 * Suchmodus nutzt. Sonst stuende beim Umschalten auf "pin" eine leere Spalte da.
 */
async function assignPins(eventId: string, rows: ImportRow[]) {
  const existing = await db
    .select({ ticketCode: guests.ticketCode, pin: guests.pin })
    .from(guests)
    .where(eq(guests.eventId, eventId));

  const pinByTicket = new Map(existing.map((row) => [row.ticketCode, row.pin]));
  const taken = new Set(existing.filter((row) => row.pin).map((row) => row.pin as string));

  // Eine aus der CSV uebernommene PIN wird nicht mehr als "belegt durch jemand
  // anderen" gewertet, wenn sie demselben Ticketcode gehoert.
  const claimedBy = new Map<string, string>();
  for (const row of existing) {
    if (row.pin) claimedBy.set(row.pin, row.ticketCode);
  }

  const warnings: { line: number; reason: string }[] = [];
  const withPins = rows.map((row, index) => {
    const previous = pinByTicket.get(row.ticketCode) ?? null;

    if (row.pin) {
      const owner = claimedBy.get(row.pin);
      if (owner === undefined || owner === row.ticketCode) {
        claimedBy.set(row.pin, row.ticketCode);
        taken.add(row.pin);
        return { ...row, pin: row.pin };
      }
      // Dieselbe PIN fuer zwei Personen waere nicht aufloesbar - hier gewinnt,
      // wer sie zuerst hatte, der Rest bekommt eine neue.
      warnings.push({
        line: index + 2,
        reason: `PIN ${row.pin} ist bereits vergeben — es wurde eine neue erzeugt.`,
      });
    }

    const pin = previous ?? createUniquePin(taken);
    taken.add(pin);
    claimedBy.set(pin, row.ticketCode);
    return { ...row, pin };
  });

  return { rows: withPins, warnings };
}
