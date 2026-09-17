import { and, eq, ilike, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { guests, type Event } from "@/db/schema";
import { displayName } from "./checkin";
import { maskEmail } from "./api";

/**
 * Gemeinsame Suche für Kiosk und Handy.
 *
 * Beide Wege müssen sich gleich verhalten — sonst wäre eine Einstellung an
 * einer Stelle wirksam und an der anderen nicht.
 */

export const MIN_QUERY_LENGTH = 3;

export type LookupResult = {
  id: string;
  name: string;
  organization: string | null;
  email: string | null;
  alreadyCheckedIn: boolean;
};

export type Lookup = {
  results: LookupResult[];
  hint: string | null;
};

/** Beschriftungen der Eingabefelder, damit Gäste nicht ins Leere tippen. */
export function lookupLabels(event: Pick<Event, "emailOnlyLookup">) {
  return event.emailOnlyLookup
    ? {
        label: "E-Mail-Adresse aus Ihrer Anmeldung",
        placeholder: "name@beispiel.de",
        help: "Bitte die vollständige Adresse eingeben, mit der Sie sich angemeldet haben.",
      }
    : {
        label: "Nachname oder E-Mail-Adresse aus Ihrer Anmeldung",
        placeholder: "Nachname",
        help: "Nachname oder die Adresse, mit der Sie sich angemeldet haben.",
      };
}

export async function lookupGuests(
  event: Event,
  rawQuery: string,
  maxResults: number,
): Promise<Lookup> {
  const query = rawQuery.trim();
  const labels = lookupLabels(event);

  if (query.length < MIN_QUERY_LENGTH) {
    return { results: [], hint: `Bitte mindestens ${MIN_QUERY_LENGTH} Zeichen eingeben.` };
  }

  // Exakte Treffer setzen voraus, dass die Eingabe ohnehin bekannt ist —
  // daraus lässt sich die Gästeliste nicht erschließen.
  const exactMatch = or(
    sql`lower(${guests.email}) = lower(${query})`,
    sql`lower(${guests.ticketCode}) = lower(${query})`,
  );

  let condition = exactMatch;

  if (!event.emailOnlyLookup && !query.includes("@")) {
    // Teiltreffer im Namen nur, wenn die Namenssuche ausdrücklich erlaubt ist.
    const pattern = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    condition = or(
      exactMatch,
      ilike(guests.lastName, pattern),
      ilike(guests.firstName, pattern),
      sql`${guests.firstName} || ' ' || ${guests.lastName} ILIKE ${pattern}`,
    );
  }

  const rows = await db
    .select()
    .from(guests)
    .where(and(eq(guests.eventId, event.id), condition))
    .orderBy(guests.lastName, guests.firstName)
    .limit(maxResults + 1);

  // Bei zu vielen Treffern lieber präziser suchen lassen, als die Liste
  // auszuspielen. Im E-Mail-Modus kann das praktisch nicht eintreten.
  if (rows.length > maxResults) {
    return {
      results: [],
      hint: "Zu viele Treffer — bitte die vollständige E-Mail-Adresse aus der Anmeldebestätigung eingeben.",
    };
  }

  if (rows.length === 0) {
    return {
      results: [],
      hint: event.emailOnlyLookup
        ? `Keine Anmeldung gefunden. ${labels.help}`
        : "Wir finden keine Anmeldung dazu.",
    };
  }

  return {
    results: rows.map((guest) => ({
      id: guest.id,
      name: displayName(guest),
      organization: guest.organization,
      email: maskEmail(guest.email),
      alreadyCheckedIn: Boolean(guest.checkedInAt),
    })),
    hint: null,
  };
}
