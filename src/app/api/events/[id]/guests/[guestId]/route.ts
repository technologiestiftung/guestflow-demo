import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, guests, scans } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { clampString } from "@/lib/utils";

type Action = "checkin" | "undo" | "ack_support" | "badge_printed";

export async function POST(
  request: Request,
  ctx: { params: Promise<{ id: string; guestId: string }> },
) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id, guestId } = await ctx.params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return fail("Veranstaltung nicht gefunden.", 404);

  const body = await request.json().catch(() => null);
  const action = clampString(body?.action, 32) as Action;

  const where = and(eq(guests.id, guestId), eq(guests.eventId, event.id));
  const guest = await db.query.guests.findFirst({ where });
  if (!guest) return fail("Gast nicht gefunden.", 404);

  switch (action) {
    case "checkin": {
      const [updated] = await db
        .update(guests)
        .set({
          checkedInAt: guest.checkedInAt ?? sql`now()`,
          lastSeenAt: sql`now()`,
          entryCount: sql`${guests.entryCount} + 1`,
        })
        .where(where)
        .returning();
      await db.insert(scans).values({
        eventId: event.id,
        guestId,
        result: guest.checkedInAt ? "re_entry" : "checked_in",
        method: "staff",
      });
      return json({ guest: updated });
    }

    case "undo": {
      // Korrektur bei Fehlscan: Anwesenheit zurücknehmen, Protokoll behalten.
      const [updated] = await db
        .update(guests)
        .set({ checkedInAt: null, lastSeenAt: null, entryCount: 0, badgePrintedAt: null })
        .where(where)
        .returning();
      await db.insert(scans).values({
        eventId: event.id,
        guestId,
        result: "checked_out",
        method: "staff",
      });
      return json({ guest: updated });
    }

    case "ack_support": {
      const [updated] = await db
        .update(guests)
        .set({ supportAckAt: sql`now()` })
        .where(where)
        .returning();
      return json({ guest: updated });
    }

    case "badge_printed": {
      const [updated] = await db
        .update(guests)
        .set({ badgePrintedAt: sql`now()` })
        .where(where)
        .returning();
      return json({ guest: updated });
    }

    default:
      return fail("Unbekannte Aktion.");
  }
}
