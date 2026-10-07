import { getEventBySlug, performCheckin, displayName } from "@/lib/checkin";
import { fail, json, maskEmail } from "@/lib/api";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { kioskCheckinSchema, readJson } from "@/lib/validation";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  // Ein Tablet scannt im Betrieb selten öfter als 1×/Sekunde.
  if (!rateLimit(clientKey(request, "checkin"), LIMITS.kioskCheckin)) {
    return fail("Zu viele Anfragen.", 429);
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) return fail("Veranstaltung nicht gefunden.", 404);

  const parsed = await readJson(request, kioskCheckinSchema);
  if (!parsed.isValid) return fail(parsed.error);

  const { code, guestId, method } = parsed.data;
  if (!code && !guestId) return fail("Kein Code übergeben.");

  const outcome = await performCheckin({ event, code, guestId, method });

  return json({
    result: outcome.result,
    message: outcome.message,
    firstEntry: outcome.firstEntry,
    badgePrinting: event.badgePrinting,
    guest: outcome.guest
      ? {
          id: outcome.guest.id,
          name: displayName(outcome.guest),
          firstName: outcome.guest.firstName,
          lastName: outcome.guest.lastName,
          organization: outcome.guest.organization,
          email: maskEmail(outcome.guest.email),
          entryCount: outcome.guest.entryCount,
          // Der Kiosk zeigt nur, DASS Unterstützung angemeldet ist — Details sieht das Team.
          hasSupportNeeds: Boolean(outcome.guest.supportNeeds),
        }
      : null,
  });
}
