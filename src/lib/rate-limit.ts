/**
 * Prozesslokaler Token-Bucket. Der Kiosk ist kein öffentliches Formular, aber
 * die Suche soll sich nicht als Adressabgleich missbrauchen lassen.
 * Für mehrere Instanzen gehört das hinter Redis — siehe README.
 */
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

export function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const refillPerMs = limit / windowMs;
  const bucket = buckets.get(key) ?? { tokens: limit, updatedAt: now };

  bucket.tokens = Math.min(limit, bucket.tokens + (now - bucket.updatedAt) * refillPerMs);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return false;
  }
  bucket.tokens -= 1;

  // Einfache Obergrenze gegen unbegrenztes Wachstum der Map.
  if (buckets.size > MAX_KEYS) {
    for (const [k, b] of buckets) {
      if (now - b.updatedAt > windowMs * 2) buckets.delete(k);
      if (buckets.size <= MAX_KEYS) break;
    }
  }
  buckets.set(key, bucket);
  return true;
}

export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "local";
  return `${scope}:${ip}`;
}
