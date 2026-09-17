import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";

export const dynamic = "force-dynamic";

/**
 * Warteschlange der Druckstation: alle, die eingecheckt sind und noch kein
 * Namensschild bekommen haben — unabhängig davon, ob sie am Kiosk, per Handy
 * oder durch das Team eingecheckt wurden.
 */
export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return fail("Veranstaltung nicht gefunden.", 404);

  const pending = await db
    .select({
      id: guests.id,
      firstName: guests.firstName,
      lastName: guests.lastName,
      organization: guests.organization,
      checkedInAt: guests.checkedInAt,
    })
    .from(guests)
    .where(
      and(
        eq(guests.eventId, event.id),
        isNotNull(guests.checkedInAt),
        isNull(guests.badgePrintedAt),
      ),
    )
    // Reihenfolge der Ankunft — so kommen die Schilder in sinnvoller Folge aus dem Drucker.
    .orderBy(asc(guests.checkedInAt))
    .limit(25);

  return json({
    pending: pending.map((guest) => ({
      ...guest,
      checkedInAt: guest.checkedInAt?.toISOString() ?? null,
    })),
  });
}
