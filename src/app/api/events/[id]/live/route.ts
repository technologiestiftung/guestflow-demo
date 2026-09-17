import { and, desc, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { events, guests } from "@/db/schema";
import { fail, json, requireAdmin } from "@/lib/api";
import { displayName } from "@/lib/checkin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await ctx.params;
  const event = await db.query.events.findFirst({ where: eq(events.id, id) });
  if (!event) return fail("Veranstaltung nicht gefunden.", 404);

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

  const recent = await db
    .select()
    .from(guests)
    .where(and(eq(guests.eventId, event.id), isNotNull(guests.lastSeenAt)))
    .orderBy(desc(guests.lastSeenAt))
    .limit(12);

  // Offene Hinweise: angekommen, Unterstützung angemeldet, noch nicht quittiert.
  const alerts = await db
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
    .limit(10);

  return json({
    stats,
    capacity: event.capacity,
    recent: recent.map((g) => ({
      id: g.id,
      name: displayName(g),
      organization: g.organization,
      lastSeenAt: g.lastSeenAt,
      entryCount: g.entryCount,
      hasSupportNeeds: Boolean(g.supportNeeds),
    })),
    alerts: alerts.map((g) => ({
      id: g.id,
      name: displayName(g),
      organization: g.organization,
      supportNeeds: g.supportNeeds,
      checkedInAt: g.checkedInAt,
    })),
  });
}
