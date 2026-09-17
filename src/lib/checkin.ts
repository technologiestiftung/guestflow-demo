import { and, eq, isNull, or, sql as raw } from "drizzle-orm";
import { db } from "@/db";
import { events, guests, scans, type Event, type Guest, type ScanResult } from "@/db/schema";

/**
 * Doo-QR-Codes enthalten je nach Konfiguration den nackten Ticketcode oder eine
 * Check-in-URL. Beides landet hier und wird auf den Code reduziert.
 */
export function normalizeScannedCode(input: string): string {
  const value = input.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) {
    try {
      const url = new URL(value);
      const fromQuery =
        url.searchParams.get("code") ??
        url.searchParams.get("ticket") ??
        url.searchParams.get("t") ??
        url.searchParams.get("id");
      if (fromQuery) return fromQuery.trim();
      const lastSegment = url.pathname.split("/").filter(Boolean).pop();
      if (lastSegment) return decodeURIComponent(lastSegment).trim();
    } catch {
      // Kein gültiger URL — unten als Rohcode weiterverwenden.
    }
  }
  return value;
}

/** Für das Scan-Log: genug zum Nachvollziehen, zu wenig zum Wiederverwenden. */
export function codeHint(code: string): string {
  if (code.length <= 4) return "****";
  return `${code.slice(0, 2)}…${code.slice(-2)} (${code.length})`;
}

/** Wie die Anwesenheit erfasst wurde — steuert nur die Auswertung, nicht die Logik. */
export type CheckinMethod = "qr" | "manual" | "staff" | "self" | "nfc";

export type CheckinOutcome = {
  result: ScanResult;
  guest: Guest | null;
  event: Event;
  /** Nur beim ersten Einlass true — steuert Namensschild-Druck. */
  firstEntry: boolean;
  message: string;
};

type CheckinInput = {
  event: Event;
  code?: string;
  guestId?: string;
  method: CheckinMethod;
};

export async function performCheckin(input: CheckinInput): Promise<CheckinOutcome> {
  const { event, method } = input;
  const code = input.code ? normalizeScannedCode(input.code) : undefined;

  const guest = await findGuest(event.id, { code, guestId: input.guestId });

  if (!guest) {
    // Existiert der Code bei einer anderen Veranstaltung? Dann ist die Ansage klarer.
    const elsewhere = code
      ? await db.query.guests.findFirst({
          where: eq(guests.ticketCode, code),
          with: { event: true },
        })
      : undefined;

    const result: ScanResult = elsewhere ? "wrong_event" : "not_found";
    await logScan(event.id, null, result, method, code);
    return {
      result,
      guest: null,
      event,
      firstEntry: false,
      message: elsewhere
        ? `Dieses Ticket gehört zu „${elsewhere.event.name}".`
        : "Wir konnten die Anmeldung nicht finden.",
    };
  }

  // Bedingtes UPDATE: Bei zwei gleichzeitigen Scans gewinnt genau einer den
  // Erst-Check-in, der andere wird sauber als Wiedereintritt gewertet.
  const [firstEntryRow] = await db
    .update(guests)
    .set({ checkedInAt: raw`now()`, lastSeenAt: raw`now()`, entryCount: 1 })
    .where(and(eq(guests.id, guest.id), isNull(guests.checkedInAt)))
    .returning();

  if (firstEntryRow) {
    await logScan(event.id, guest.id, "checked_in", method, code);
    return {
      result: "checked_in",
      guest: firstEntryRow,
      event,
      firstEntry: true,
      message: "Willkommen!",
    };
  }

  if (!event.allowReEntry) {
    await logScan(event.id, guest.id, "re_entry", method, code);
    return {
      result: "re_entry",
      guest,
      event,
      firstEntry: false,
      message: "Bereits eingecheckt — bitte beim Team melden.",
    };
  }

  const [reEntryRow] = await db
    .update(guests)
    .set({ lastSeenAt: raw`now()`, entryCount: raw`${guests.entryCount} + 1` })
    .where(eq(guests.id, guest.id))
    .returning();

  await logScan(event.id, guest.id, "re_entry", method, code);
  return {
    result: "re_entry",
    guest: reEntryRow ?? guest,
    event,
    firstEntry: false,
    message: "Willkommen zurück!",
  };
}

async function findGuest(
  eventId: string,
  by: { code?: string; guestId?: string },
): Promise<Guest | undefined> {
  if (by.guestId) {
    return db.query.guests.findFirst({
      where: and(eq(guests.id, by.guestId), eq(guests.eventId, eventId)),
    });
  }
  if (!by.code) return undefined;
  const code = by.code;
  return db.query.guests.findFirst({
    where: and(
      eq(guests.eventId, eventId),
      or(
        eq(guests.ticketCode, code),
        // Groß-/Kleinschreibung und E-Mail als Fallback-Code zulassen.
        raw`lower(${guests.ticketCode}) = lower(${code})`,
        raw`lower(${guests.email}) = lower(${code})`,
      ),
    ),
  });
}

async function logScan(
  eventId: string,
  guestId: string | null,
  result: ScanResult,
  method: CheckinMethod,
  code?: string,
) {
  await db.insert(scans).values({
    eventId,
    guestId,
    result,
    method,
    rawCodeHint: code ? codeHint(code) : null,
  });
}

export async function getEventBySlug(slug: string): Promise<Event | undefined> {
  return db.query.events.findFirst({ where: eq(events.slug, slug) });
}

export function displayName(guest: Pick<Guest, "firstName" | "lastName">): string {
  return [guest.firstName, guest.lastName].filter(Boolean).join(" ").trim();
}
