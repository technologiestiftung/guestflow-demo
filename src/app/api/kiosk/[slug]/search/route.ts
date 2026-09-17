import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { getEventBySlug, displayName } from "@/lib/checkin";
import { fail, json, maskEmail } from "@/lib/api";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { clampString } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MIN_QUERY = 3;
const MAX_RESULTS = 6;

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  // Deutlich enger als der Check-in: die Suche ist der heiklere Endpunkt.
  if (!rateLimit(clientKey(request, "search"), LIMITS.kioskSearch)) {
    return fail("Zu viele Suchanfragen.", 429);
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) return fail("Veranstaltung nicht gefunden.", 404);
  if (!event.manualSearch) return fail("Suche ist für diese Veranstaltung deaktiviert.", 403);

  const query = clampString(new URL(request.url).searchParams.get("q"), 80);
  if (query.length < MIN_QUERY) {
    return json({ results: [], hint: `Bitte mindestens ${MIN_QUERY} Zeichen eingeben.` });
  }

  const pattern = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;
  const rows = await db
    .select()
    .from(guests)
    .where(
      and(
        eq(guests.eventId, event.id),
        or(
          ilike(guests.lastName, pattern),
          ilike(guests.firstName, pattern),
          ilike(guests.email, pattern),
          sql`${guests.firstName} || ' ' || ${guests.lastName} ILIKE ${pattern}`,
        ),
      ),
    )
    .orderBy(guests.lastName, guests.firstName)
    .limit(MAX_RESULTS + 1);

  // Bei zu vielen Treffern lieber präziser suchen lassen, als die Liste auszuspielen.
  if (rows.length > MAX_RESULTS) {
    return json({ results: [], hint: "Zu viele Treffer — bitte den vollständigen Namen eingeben." });
  }

  return json({
    results: rows.map((guest) => ({
      id: guest.id,
      name: displayName(guest),
      organization: guest.organization,
      email: maskEmail(guest.email),
      alreadyCheckedIn: Boolean(guest.checkedInAt),
    })),
    hint: rows.length === 0 ? "Keine Anmeldung gefunden." : null,
  });
}
