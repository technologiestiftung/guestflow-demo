import { getEventBySlug } from "@/lib/checkin";
import { fail, json } from "@/lib/api";
import { lookupGuests } from "@/lib/guest-lookup";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { clampString } from "@/lib/utils";

export const dynamic = "force-dynamic";

const MAX_RESULTS = 6;

export async function GET(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(clientKey(request, "search"), LIMITS.kioskSearch)) {
    return fail("Zu viele Suchanfragen.", 429);
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) return fail("Veranstaltung nicht gefunden.", 404);
  if (!event.manualSearch) return fail("Suche ist für diese Veranstaltung deaktiviert.", 403);

  const query = clampString(new URL(request.url).searchParams.get("q"), 120);
  return json(await lookupGuests(event, query, MAX_RESULTS));
}
