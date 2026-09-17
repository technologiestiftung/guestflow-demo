/**
 * Ermittelt die Postgres-Verbindungsadresse.
 *
 * Vorrang hat DATABASE_URL (praktisch für lokale Entwicklung und für Hoster,
 * die genau diese Variable setzen). Andernfalls wird sie aus den Einzelteilen
 * zusammengesetzt — so muss in docker-compose.yml und .env nie eine vollständige
 * Adresse mit eingebetteten Zugangsdaten stehen.
 */
export function resolveDatabaseUrl(env: NodeJS.ProcessEnv = process.env): string | undefined {
  const direct = env.DATABASE_URL?.trim();
  if (direct) return direct;

  const host = env.DB_HOST?.trim();
  const name = env.DB_NAME?.trim();
  const user = env.DB_USER?.trim();
  if (!host || !name || !user) return undefined;

  const port = env.DB_PORT?.trim() || "5432";

  // Sonderzeichen in den Zugangsdaten müssen kodiert werden, sonst zerfällt
  // die Adresse beim Parsen.
  const account = [encodeURIComponent(user), encodeURIComponent(env.DB_PASSWORD ?? "")].join(":");
  const location = [host, port].join(":");

  return ["postgresql://", account, "@", location, "/", encodeURIComponent(name)].join("");
}

export function requireDatabaseUrl(): string {
  const url = resolveDatabaseUrl();
  if (!url) {
    throw new Error(
      "Keine Datenbankverbindung konfiguriert. Entweder DATABASE_URL setzen oder " +
        "DB_HOST, DB_NAME, DB_USER und DB_PASSWORD (siehe .env.example).",
    );
  }
  return url;
}
