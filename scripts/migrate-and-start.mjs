/**
 * Container-Start: erst Migrationen, dann der Server.
 * Postgres braucht beim ersten Hochfahren einen Moment — deshalb wird die
 * Verbindung mehrfach versucht, statt sofort aufzugeben.
 */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/**
 * Verbindungsadresse ermitteln. Vorrang hat DATABASE_URL; sonst wird sie aus
 * den Einzelteilen gebaut, damit in .env und docker-compose.yml keine
 * vollstaendige Adresse mit Zugangsdaten stehen muss.
 */
function resolveConnection(env) {
  if (env.DATABASE_URL?.trim()) return env.DATABASE_URL.trim();

  const host = env.DB_HOST?.trim();
  const name = env.DB_NAME?.trim();
  const user = env.DB_USER?.trim();
  if (!host || !name || !user) return undefined;

  const port = env.DB_PORT?.trim() || "5432";
  const account = [encodeURIComponent(user), encodeURIComponent(env.DB_PASSWORD ?? "")].join(":");
  return ["postgresql://", account, "@", host, ":", port, "/", encodeURIComponent(name)].join("");
}

const connectionString = resolveConnection(process.env);
if (!connectionString) {
  console.error(
    "Keine Datenbankverbindung konfiguriert (DATABASE_URL oder DB_HOST/DB_NAME/DB_USER). Abbruch.",
  );
  process.exit(1);
}

// Der Next.js-Server laeuft im selben Prozess und liest diese Variable.
process.env.DATABASE_URL = connectionString;

const MAX_ATTEMPTS = 15;
const DELAY_MS = 2000;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function runMigrations() {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const client = postgres(connectionString, {
      max: 1,
      connect_timeout: 5,
      onnotice: () => {},
    });
    try {
      await migrate(drizzle(client), { migrationsFolder: "./drizzle" });
      console.log("Migrationen angewendet.");
      return;
    } catch (error) {
      console.warn(
        `Datenbank noch nicht bereit (Versuch ${attempt}/${MAX_ATTEMPTS}): ${error.message}`,
      );
      if (attempt === MAX_ATTEMPTS) throw error;
      await wait(DELAY_MS);
    } finally {
      await client.end({ timeout: 5 }).catch(() => {});
    }
  }
}

await runMigrations();
console.log("Starte GuestFlow …");
await import("./../server.js");
