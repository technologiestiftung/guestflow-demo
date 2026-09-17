import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { guests } from "@/db/schema";
import { displayName, getEventBySlug, performCheckin } from "@/lib/checkin";
import { fail, json } from "@/lib/api";
import { clientKey, LIMITS, rateLimit } from "@/lib/rate-limit";
import { hasEventAccess, readPass, writePass } from "@/lib/self-service";
import { createPassToken } from "@/lib/tokens";
import { clampString } from "@/lib/utils";

export const dynamic = "force-dynamic";

export async function POST(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  if (!rateLimit(clientKey(request, "self-checkin"), LIMITS.selfCheckin)) {
    return fail("Zu viele Anfragen.", 429);
  }

  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event || event.archivedAt) return fail("Veranstaltung nicht gefunden.", 404);
  if (!event.selfServiceEnabled) return fail("Die Anmeldung per Handy ist deaktiviert.", 403);
  if (!(await hasEventAccess(event))) return fail("Bitte den QR-Code am Eingang scannen.", 403);

  const body = await request.json().catch(() => null);
  const requestedId = clampString(body?.guestId, 64);
  // Der Kanal kommt aus der Seite, die den Aufruf ausgelöst hat.
  const method = body?.channel === "nfc" ? ("nfc" as const) : ("self" as const);

  // Wiedereintritt: das Telefon trägt den Ausweis, es ist keine Suche nötig.
  const pass = await readPass(event);
  let guestId = requestedId;
  if (!guestId && pass) {
    const known = await db.query.guests.findFirst({
      where: and(eq(guests.eventId, event.id), eq(guests.passToken, pass)),
      columns: { id: true },
    });
    guestId = known?.id ?? "";
  }
  if (!guestId) return fail("Bitte zuerst die Anmeldung auswählen.");

  const outcome = await performCheckin({ event, guestId, method });
  if (!outcome.guest) return fail("Anmeldung nicht gefunden.", 404);

  // Ausweis einmalig vergeben und im Cookie hinterlegen.
  let passToken = outcome.guest.passToken;
  if (!passToken) {
    passToken = createPassToken();
    await db.update(guests).set({ passToken }).where(eq(guests.id, outcome.guest.id));
  }
  await writePass(event, passToken);

  return json({
    result: outcome.result,
    firstEntry: outcome.firstEntry,
    guest: {
      id: outcome.guest.id,
      name: displayName(outcome.guest),
      organization: outcome.guest.organization,
      entryCount: outcome.guest.entryCount,
      hasSupportNeeds: Boolean(outcome.guest.supportNeeds),
    },
  });
}

/** Ausweis vom Telefon entfernen — für geteilte Geräte am Empfang. */
export async function DELETE(request: Request, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const event = await getEventBySlug(slug);
  if (!event) return fail("Veranstaltung nicht gefunden.", 404);
  const { cookies } = await import("next/headers");
  const { passCookie } = await import("@/lib/self-service");
  (await cookies()).delete(passCookie(event.slug));
  return json({ ok: true });
}
