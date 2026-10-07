import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "@/db/schema";
import { resolveDatabaseUrl } from "@/lib/database-url";

/**
 * Die Verbindung wird erst beim ersten Zugriff aufgebaut, nicht beim Import.
 * Dadurch braucht `next build` keine Zugangsdaten — im Image landet also kein
 * einziger Platzhalterwert, und der Container startet ohne Datenbank nicht
 * halbgar, sondern meldet den fehlenden Wert dort, wo er gebraucht wird.
 */
type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as {
  __guestflowSql?: postgres.Sql;
  __guestflowDb?: Database;
};

function connect(): { sql: postgres.Sql; db: Database } {
  if (globalForDb.__guestflowSql && globalForDb.__guestflowDb) {
    return { sql: globalForDb.__guestflowSql, db: globalForDb.__guestflowDb };
  }

  const connectionString = resolveDatabaseUrl();
  if (!connectionString) {
    throw new Error(
      "Keine Datenbankverbindung konfiguriert. Bitte .env anlegen (siehe .env.example) " +
        "oder per Docker Compose starten.",
    );
  }

  const client = postgres(connectionString, {
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    idle_timeout: 20,
    connect_timeout: 10,
  });
  const database = drizzle(client, { schema });

  // Im Dev-Modus überlebt der Client den Hot Reload, sonst läuft der Pool voll.
  globalForDb.__guestflowSql = client;
  globalForDb.__guestflowDb = database;
  return { sql: client, db: database };
}

export const db = new Proxy({} as Database, {
  get(_target, property) {
    const database = connect().db;
    const value = database[property as keyof Database];
    return typeof value === "function" ? value.bind(database) : value;
  },
}) as Database;

/** Roher Client für Skripte und Healthchecks. */
export function getSql(): postgres.Sql {
  return connect().sql;
}

export { schema };
