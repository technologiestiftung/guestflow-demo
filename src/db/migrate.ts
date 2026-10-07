import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { requireDatabaseUrl } from "@/lib/database-url";

const connectionString = requireDatabaseUrl();

async function main() {
  // max: 1 — Migrationen laufen streng sequenziell auf einer Verbindung.
  const sql = postgres(connectionString, { max: 1 });
  try {
    await migrate(drizzle(sql), { migrationsFolder: "./drizzle" });
    console.log("Migrationen angewendet.");
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error("Migration fehlgeschlagen:", err);
  process.exit(1);
});
