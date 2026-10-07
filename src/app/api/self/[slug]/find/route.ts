import { fail, json } from "@/lib/api";
import { getEventBySlug } from "@/lib/checkin";
import { lookupGuests } from "@/lib/guest-lookup";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { hasEventAccess } from "@/lib/self-service";
import { lookupSchema, readJson } from "@/lib/validation";

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

  const parsed = await readJson(request, lookupSchema);
  if (!parsed.isValid) return fail(parsed.error);

  const lookup = await lookupGuests(event, parsed.data.query, MAX_RESULTS);

  // Rateversuche auf die PIN werden je Veranstaltung gedeckelt — derselbe Topf
  // wie am Kiosk, damit sich die Bremse nicht über zwei Wege umgehen lässt.
  if (lookup.isPinMiss && !rateLimit(`pin:${event.id}`, LIMITS.pinAttempt)) {
    return fail("Zu viele Fehlversuche. Bitte am Empfang melden.", 429);
  }

  return json({ results: lookup.results, hint: lookup.hint });
}
