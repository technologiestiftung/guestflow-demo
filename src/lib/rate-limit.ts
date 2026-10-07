/**
 * Prozesslokaler Token-Bucket.
 *
 * Zur Herkunft der Anfrage: `X-Forwarded-For` kann jeder Client selbst setzen.
 * Ohne vorgeschalteten Reverse Proxy ist der Header daher wertlos — wer ihn bei
 * jeder Anfrage variiert, hebelt jede Begrenzung aus. Deshalb wird er nur
 * ausgewertet, wenn über TRUST_PROXY ausdrücklich bestätigt ist, dass ein
 * Proxy davorsteht und ihn setzt. Sonst laufen alle Anfragen eines Bereichs in
 * denselben Topf.
 *
 * Für mehrere Instanzen gehört das hinter einen gemeinsamen Speicher — siehe README.
 */
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

export type Rule = { limit: number; windowMs: number };

/** Verbraucht ein Token je Regel. Nur wenn alle Regeln Luft haben, gilt es als erlaubt. */
export function rateLimit(key: string, rules: Rule | Rule[]): boolean {
  const list = Array.isArray(rules) ? rules : [rules];
  const now = Date.now();

  // Erst prüfen, dann verbrauchen: sonst zehrt eine bereits erschöpfte Regel
  // die übrigen mit auf.
  const states = list.map((rule, index) => {
    const bucketKey = `${key}#${index}`;
    const bucket = buckets.get(bucketKey) ?? { tokens: rule.limit, updatedAt: now };
    const refilled = Math.min(
      rule.limit,
      bucket.tokens + ((now - bucket.updatedAt) * rule.limit) / rule.windowMs,
    );
    return { bucketKey, rule, tokens: refilled };
  });

  const allowed = states.every((state) => state.tokens >= 1);

  for (const state of states) {
    buckets.set(state.bucketKey, {
      tokens: allowed ? state.tokens - 1 : state.tokens,
      updatedAt: now,
    });
  }

  pruneOccasionally(now);
  return allowed;
}

/** Einfache Obergrenze gegen unbegrenztes Wachstum der Map. */
function pruneOccasionally(now: number) {
  if (buckets.size <= MAX_KEYS) return;
  for (const [key, bucket] of buckets) {
    if (now - bucket.updatedAt > 3_600_000) buckets.delete(key);
    if (buckets.size <= MAX_KEYS) break;
  }
}

function trustProxy(): boolean {
  return process.env.TRUST_PROXY === "true";
}

/**
 * Kennung der Gegenstelle.
 *
 * Ohne vertrauenswürdigen Proxy gibt es keine belastbare Client-Adresse, und
 * bei einer Veranstaltung teilen sich ohnehin alle Gäste im WLAN eine einzige
 * öffentliche Adresse. Die Begrenzung wirkt dann bewusst pro Bereich statt pro
 * Gerät; die Grenzwerte sind entsprechend darauf ausgelegt.
 */
export function clientKey(request: Request, scope: string): string {
  if (trustProxy()) {
    const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const ip = forwarded || request.headers.get("x-real-ip");
    if (ip) return `${scope}:${ip}`;
  }
  return `${scope}:shared`;
}

/* --------------------------------------------------------------------------
   Grenzwerte an einer Stelle, damit die Begründungen nachlesbar bleiben.
   -------------------------------------------------------------------------- */
export const LIMITS = {
  /**
   * Nur fehlgeschlagene Anmeldeversuche zählen (siehe Login-Route). Ein
   * richtiges Passwort kommt deshalb immer durch — Aussperren des Teams durch
   * absichtliches Volllaufenlassen ist damit ausgeschlossen.
   */
  loginFailures: [
    { limit: 10, windowMs: 60_000 },
    { limit: 60, windowMs: 3_600_000 },
  ] satisfies Rule[],

  /** Ein Kiosk scannt selten öfter als einmal pro Sekunde; Reserve für mehrere Geräte. */
  kioskCheckin: { limit: 180, windowMs: 60_000 } satisfies Rule,

  /** Namenssuche am Kiosk — nur ein Gerät, aber tippende Menschen. */
  kioskSearch: { limit: 90, windowMs: 60_000 } satisfies Rule,

  /**
   * Gästeseite: beim Einlass tippen viele Menschen gleichzeitig, alle hinter
   * derselben öffentlichen Adresse. Zu enge Werte würden den Einlass
   * blockieren. Der eigentliche Schutz ist der Zugangsschlüssel plus die
   * Begrenzung auf wenige Treffer je Suche.
   */
  selfFind: { limit: 300, windowMs: 60_000 } satisfies Rule,

  /**
   * Fehlversuche im PIN-Modus, gezaehlt je Veranstaltung.
   *
   * Sechs Ziffern sind rund eine Million Kombinationen. Bei 500 Gaesten trifft
   * ein zufaelliger Versuch mit etwa 1:2000 irgendeinen Gast - ohne Bremse
   * waere der Modus in wenigen Stunden durchprobiert. Mit diesen Werten dauert
   * ein Treffer im Mittel laenger als jede Veranstaltung.
   *
   * Nur Fehlversuche zaehlen; eine richtige PIN kommt immer durch, damit sich
   * Gaeste nicht durch fremde Rateversuche ausgesperrt finden.
   */
  pinAttempt: [
    { limit: 12, windowMs: 60_000 },
    { limit: 120, windowMs: 3_600_000 },
  ] satisfies Rule[],
  selfCheckin: { limit: 300, windowMs: 60_000 } satisfies Rule,
} as const;
