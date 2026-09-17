import { getEventBySlug } from "@/lib/checkin";
import { fail, json } from "@/lib/api";
import { lookupGuests } from "@/lib/guest-lookup";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { hasEventAccess } from "@/lib/self-service";
import { clampString } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 5;

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(clientKey(request, "self-find"), LIMITS.selfFind)) {
    return fail("Zu viele Versuche. Bitte einen Moment warten.", 429);
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) return fail("Veranstaltung nicht gefunden.", 404);
  if (!event.selfServiceEnabled) return fail("Die Anmeldung per Handy ist deaktiviert.", 403);
  if (!(await hasEventAccess(event))) return fail("Bitte den QR-Code am Eingang scannen.", 403);

  const body = await request.json().catch(() => null);
  const query = clampString(body?.query, 120);
  return json(await lookupGuests(event, query, MAX_RESULTS));
}
