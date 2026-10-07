import { and, eq, ilike, or, type SQL, sql } from "drizzle-orm";

import { db } from "@/db";
import { guests, type Event, type LookupMode } from "@/db/schema";
import { maskEmail } from "@/lib/api";
import { displayName } from "@/lib/checkin";
import { isValidPin, normalizePin } from "@/lib/pin";

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
  hasCheckedIn: boolean;
};

export type Lookup = {
  results: LookupResult[];
  hint: string | null;
  /**
   * Fehlversuch im PIN-Modus. Der Aufrufer zieht dafür Budget ab: Eine
   * sechsstellige PIN hat rund eine Million Kombinationen, bei einigen hundert
   * Gästen trifft ein Rateversuch also mit spürbarer Wahrscheinlichkeit
   * irgendjemanden. Ohne Bremse wäre der Modus durchprobierbar.
   */
  isPinMiss: boolean;
};

export type SearchLabels = {
  label: string;
  placeholder: string;
  help: string;
  /** Ziffernfeld statt Textfeld auf dem Telefon. */
  isNumeric: boolean;
};

/** Beschriftungen der Eingabefelder, damit Gäste nicht ins Leere tippen. */
export function lookupLabels(event: Pick<Event, "lookupMode">): SearchLabels {
  switch (event.lookupMode) {
    case "pin":
      return {
        label: "Sechsstellige PIN aus Ihrer Anmeldung",
        placeholder: "482913",
        help: "Bitte die sechsstellige PIN eingeben, die Sie mit Ihrer Anmeldung erhalten haben.",
        isNumeric: true,
      };
    case "email":
      return {
        label: "E-Mail-Adresse aus Ihrer Anmeldung",
        placeholder: "name@beispiel.de",
        help: "Bitte die vollständige Adresse eingeben, mit der Sie sich angemeldet haben.",
        isNumeric: false,
      };
    default:
      return {
        label: "Nachname oder E-Mail-Adresse aus Ihrer Anmeldung",
        placeholder: "Nachname",
        help: "Nachname oder die Adresse, mit der Sie sich angemeldet haben.",
        isNumeric: false,
      };
  }
}

function emptyResult(hint: string, isPinMiss = false): Lookup {
  return { results: [], hint, isPinMiss };
}

export async function lookupGuests(
  event: Event,
  rawQuery: string,
  maxResults: number,
): Promise<Lookup> {
  const query = rawQuery.trim();
  const labels = lookupLabels(event);

  if (event.lookupMode === "pin") return lookupByPin(event, query, labels);

  if (query.length < MIN_QUERY_LENGTH) {
    return emptyResult(`Bitte mindestens ${MIN_QUERY_LENGTH} Zeichen eingeben.`);
  }

  // Exakte Treffer setzen voraus, dass die Eingabe ohnehin bekannt ist —
  // daraus lässt sich die Gästeliste nicht erschließen.
  const exactMatch = or(
    sql`lower(${guests.email}) = lower(${query})`,
    sql`lower(${guests.ticketCode}) = lower(${query})`,
  );

  let condition = exactMatch;

  if (event.lookupMode === "name" && !query.includes("@")) {
    // Teiltreffer im Namen nur, wenn die Namenssuche ausdrücklich erlaubt ist.
    const pattern = `%${query.replace(/[%_]/g, (match) => `\\${match}`)}%`;
    condition = or(
      exactMatch,
      ilike(guests.lastName, pattern),
      ilike(guests.firstName, pattern),
      sql`${guests.firstName} || ' ' || ${guests.lastName} ILIKE ${pattern}`,
    );
  }

  const rows = await findGuests(event.id, condition, maxResults + 1);

  // Bei zu vielen Treffern lieber präziser suchen lassen, als die Liste
  // auszuspielen. Außerhalb des Namensmodus kann das praktisch nicht eintreten.
  if (rows.length > maxResults) {
    return emptyResult(
      "Zu viele Treffer — bitte die vollständige E-Mail-Adresse aus der Anmeldebestätigung eingeben.",
    );
  }

  if (rows.length === 0) {
    return emptyResult(
      event.lookupMode === "email"
        ? `Keine Anmeldung gefunden. ${labels.help}`
        : "Wir finden keine Anmeldung dazu.",
    );
  }

  return { results: rows.map(toResult), hint: null, isPinMiss: false };
}

async function lookupByPin(event: Event, query: string, labels: SearchLabels): Promise<Lookup> {
  const pin = normalizePin(query);

  // Eine unvollständige Eingabe ist kein Rateversuch, sondern ein Tippfehler —
  // sie zieht deshalb kein Budget ab.
  if (!isValidPin(pin)) {
    return emptyResult(`Bitte sechs Ziffern eingeben. ${labels.help}`);
  }

  const rows = await findGuests(event.id, eq(guests.pin, pin), 2);

  if (rows.length === 0) {
    return emptyResult("Diese PIN kennen wir nicht. Bitte am Empfang melden.", true);
  }

  return { results: rows.slice(0, 1).map(toResult), hint: null, isPinMiss: false };
}

function findGuests(eventId: string, condition: SQL | undefined, limit: number) {
  return db
    .select()
    .from(guests)
    .where(and(eq(guests.eventId, eventId), condition))
    .orderBy(guests.lastName, guests.firstName)
    .limit(limit);
}

function toResult(guest: typeof guests.$inferSelect): LookupResult {
  return {
    id: guest.id,
    name: displayName(guest),
    organization: guest.organization,
    email: maskEmail(guest.email),
    hasCheckedIn: Boolean(guest.checkedInAt),
  };
}
