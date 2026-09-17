import type { Config } from "drizzle-kit";
import { resolveDatabaseUrl } from "./src/lib/database-url";

// `generate` braucht keine Verbindung — nur `migrate`/`push` greifen wirklich zu.
// Deshalb hier ein neutraler Platzhalter statt eines harten Abbruchs.
const url = resolveDatabaseUrl() ?? "postgresql://localhost:5432/guestflow";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
  strict: true,
} satisfies Config;
