import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { getEventBySlug, displayName } from "@/lib/checkin";
import { fail, json, maskEmail } from "@/lib/api";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { hasEventAccess } from "@/lib/self-service";
import { clampString } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MIN_QUERY = 3;
const MAX_RESULTS = 5;

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  // Enger als am Kiosk: hier tippt jeder Gast auf seinem eigenen Gerät.
  if (!rateLimit(clientKey(request, "self-find"), 15, 60_000)) {
    return fail("Zu viele Versuche. Bitte einen Moment warten.", 429);
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) return fail("Veranstaltung nicht gefunden.", 404);
  if (!event.selfServiceEnabled) return fail("Die Anmeldung per Handy ist deaktiviert.", 403);
  if (!(await hasEventAccess(event))) return fail("Bitte den QR-Code am Eingang scannen.", 403);

  const body = await request.json().catch(() => null);
  const query = clampString(body?.query, 120);
  if (query.length < MIN_QUERY) {
    return json({ results: [], hint: `Bitte mindestens ${MIN_QUERY} Zeichen eingeben.` });
  }

  const isEmail = query.includes("@");
  const pattern = `%${query.replace(/[%_]/g, (m) => `\\${m}`)}%`;

  const rows = await db
    .select()
    .from(guests)
    .where(
      and(
        eq(guests.eventId, event.id),
        isEmail
          ? // E-Mail ist eindeutig — exakter Treffer statt Namensliste.
            sql`lower(${guests.email}) = lower(${query})`
          : or(
              ilike(guests.lastName, pattern),
              sql`${guests.firstName} || ' ' || ${guests.lastName} ILIKE ${pattern}`,
              sql`lower(${guests.ticketCode}) = lower(${query})`,
            ),
      ),
    )
    .orderBy(guests.lastName, guests.firstName)
    .limit(MAX_RESULTS + 1);

  if (rows.length > MAX_RESULTS) {
    return json({
      results: [],
      hint: "Zu viele Treffer. Bitte die E-Mail-Adresse aus der Anmeldebestätigung eingeben.",
    });
  }

  return json({
    results: rows.map((guest) => ({
      id: guest.id,
      name: displayName(guest),
      organization: guest.organization,
      email: maskEmail(guest.email),
      alreadyCheckedIn: Boolean(guest.checkedInAt),
    })),
    hint: rows.length === 0 ? "Wir finden keine Anmeldung dazu." : null,
  });
}
