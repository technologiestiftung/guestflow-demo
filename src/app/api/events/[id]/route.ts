import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { createUniquePin } from "@/lib/pin-generator";
import { createPublicToken } from "@/lib/tokens";
import { readJson, updateEventSchema } from "@/lib/validation";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const parsed = await readJson(request, updateEventSchema);
  if (!parsed.isValid) return fail(parsed.error);

  const { archived, rotateToken, location, ...flags } = parsed.data;
  const patch: Partial<typeof events.$inferInsert> = { ...flags };

  // Neuer Schlüssel macht alle ausgehängten QR-Codes und beschriebenen
  // NFC-Plaketten ungültig.
  if (rotateToken) patch.publicToken = createPublicToken();
  if (archived !== undefined) patch.archivedAt = archived ? new Date() : null;
  if (location !== undefined) patch.location = location || null;

  if (Object.keys(patch).length === 0) return fail("Keine Änderung übergeben.");

  const [updated] = await db.update(events).set(patch).where(eq(events.id, id)).returning();
  if (!updated) return fail("Veranstaltung nicht gefunden.", 404);

  // Beim Umschalten auf den PIN-Modus fehlende PINs nachtragen. Gäste aus einem
  // Import vor dieser Funktion hätten sonst keine und kämen nicht hinein.
  const pinsCreated = patch.lookupMode === "pin" ? await backfillPins(updated.id) : 0;

  return json({ event: updated, pinsCreated });
}

async function backfillPins(eventId: string): Promise<number> {
  const rows = await db
    .select({ id: guests.id, pin: guests.pin })
    .from(guests)
    .where(eq(guests.eventId, eventId));

  const taken = new Set(rows.filter((row) => row.pin).map((row) => row.pin as string));
  const missing = rows.filter((row) => !row.pin);

  for (const guest of missing) {
    await db
      .update(guests)
      .set({ pin: createUniquePin(taken) })
      .where(eq(guests.id, guest.id));
  }

  return missing.length;
}

/**
 * Datenlöschung nach der Veranstaltung.
 * ?mode=guests  -> nur Gästedaten, Veranstaltung und Statistik bleiben
 * ?mode=event   -> Veranstaltung samt allem
 */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const mode = new URL(request.url).searchParams.get("mode") ?? "guests";

  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return fail("Veranstaltung nicht gefunden.", 404);

  if (mode === "event") {
    // Gäste und Scans hängen per ON DELETE CASCADE daran.
    await db.delete(events).where(eq(events.id, id));
    return json({ deleted: "event" });
  }

  const removed = await db.delete(guests).where(eq(guests.eventId, id)).returning({ id: guests.id });
  return json({ deleted: "guests", count: removed.length });
}
