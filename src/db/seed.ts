/**
 * Testdaten für die lokale Entwicklung.
 * Alle Personen sind frei erfunden. Niemals mit echten Gästedaten befüllen.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { randomBytes } from "node:crypto";
import { events, guests } from "@/db/schema";
import * as schema from "@/db/schema";
import { requireDatabaseUrl } from "@/lib/database-url";

const connectionString = requireDatabaseUrl();

const ORGS = [
  "Stadtwerke Musterstadt",
  "Hochschule Beispielstadt",
  "Verein Digitale Nachbarschaft",
  "Beispiel GmbH",
  "Bezirksamt Musterbezirk",
  null,
];

const SUPPORT = [
  "Rollstuhlgerechter Zugang benötigt",
  "Verdolmetschung in Gebärdensprache",
  "Begleitperson kommt mit",
  "Platz in der ersten Reihe (Sehbeeinträchtigung)",
];

const SOURCES = ["Newsletter", "Website", "Empfehlung", "Social Media", "Presse"];

const FIRST = ["Alex", "Bo", "Charlie", "Dana", "Eli", "Fin", "Gin", "Hanne", "Ira", "Jo", "Kim", "Luca", "Mika", "Noa", "Ola", "Pia", "Quin", "Robin", "Sam", "Toni"];
const LAST = ["Amsel", "Birke", "Caspari", "Dohle", "Erle", "Falke", "Ginster", "Hafer", "Iltis", "Jasmin", "Kiebitz", "Linde", "Moos", "Nessel", "Olive", "Pappel", "Quitte", "Raute", "Salbei", "Tanne"];

async function main() {
  const sql = postgres(connectionString, { max: 1 });
  const db = drizzle(sql, { schema });

  try {
    const startsAt = new Date();
    startsAt.setHours(18, 0, 0, 0);

    const [event] = await db
      .insert(events)
      .values({
        name: "Jahresempfang 2026 (Testdaten)",
        slug: `testveranstaltung-${randomBytes(3).toString("hex")}`,
        location: "Musterhalle, Saal 1",
        startsAt,
        capacity: 120,
        publicToken: randomBytes(9).toString("base64url"),
      })
      .returning();

    const rows = Array.from({ length: 80 }, (_, i) => {
      const firstName = FIRST[i % FIRST.length];
      const lastName = LAST[Math.floor(i / FIRST.length) % LAST.length] + (i > 19 ? `-${LAST[i % LAST.length]}` : "");
      // Jede achte Person meldet Unterstützungsbedarf an.
      const support = i % 8 === 0 ? SUPPORT[i % SUPPORT.length] : null;
      return {
        eventId: event.id,
        ticketCode: `TEST-${String(1000 + i)}`,
        firstName,
        lastName,
        email: `${firstName}.${lastName}${i}@example.invalid`.toLowerCase(),
        organization: ORGS[i % ORGS.length],
        source: SOURCES[i % SOURCES.length],
        supportNeeds: support,
        ticketType: i % 5 === 0 ? "Presse" : "Standard",
      };
    });

    await db.insert(guests).values(rows);

    console.log(`Testveranstaltung angelegt: ${event.name}`);
    console.log(`Kiosk:        /kiosk/${event.slug}`);
    console.log(`Aushang-Link: /e/${event.slug}?k=${event.publicToken}`);
    console.log(`${rows.length} erfundene Gäste importiert. Beispielcode zum Scannen: TEST-1000`);
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error("Seed fehlgeschlagen:", error);
  process.exit(1);
});
