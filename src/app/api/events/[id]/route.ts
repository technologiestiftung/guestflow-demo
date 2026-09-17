import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { clampString } from "@/lib/utils";
import { createPublicToken } from "@/lib/tokens";

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const body = await request.json().catch(() => null);
  const patch: Record<string, unknown> = {};

  for (const flag of [
    "badgePrinting",
    "manualSearch",
    "allowReEntry",
    "selfServiceEnabled",
    "emailOnlyLookup",
  ] as const) {
    if (typeof body?.[flag] === "boolean") patch[flag] = body[flag];
  }
  // Neuer Schlüssel macht alle ausgehängten QR-Codes ungültig.
  if (body?.rotateToken === true) patch.publicToken = createPublicToken();
  if (body?.archived === true) patch.archivedAt = new Date();
  if (body?.archived === false) patch.archivedAt = null;
  if (typeof body?.location === "string") patch.location = clampString(body.location, 160) || null;

  if (Object.keys(patch).length === 0) return fail("Keine Änderung übergeben.");

  const [updated] = await db.update(events).set(patch).where(eq(events.id, id)).returning();
  if (!updated) return fail("Veranstaltung nicht gefunden.", 404);
  return json({ event: updated });
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
