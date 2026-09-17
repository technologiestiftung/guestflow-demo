# GuestFlow

Self-Check-in für Besucher:innen bei Veranstaltungen.

Gäste melden sich in wenigen Sekunden selbst an — mit dem eigenen Telefon über eine
NFC-Plakette oder einen QR-Aushang, oder am Tablet vor Ort. Das Team sieht in Echtzeit,
wer eingetroffen ist, wer noch fehlt und wer Unterstützung angemeldet hat.

Next.js 15 · PostgreSQL 17 · Tailwind CSS v4 · Docker Compose

---

## Warum

Bei Veranstaltungen mit begrenzter Platzkapazität muss vor Ort die Anmeldeliste mit dem
Nachweis der Gäste abgeglichen werden. Das kostet Zeit und Personal — besonders, wenn
Gäste den Ort zwischendurch verlassen und erneut eintreten.

GuestFlow automatisiert diesen Abgleich und dokumentiert die Anwesenheit, ohne dass
dauerhaft jemand am Einlass stehen muss.

---

## Drei Wege zum Check-in

| Weg | Gerät | Wie es abläuft |
| --- | --- | --- |
| **NFC-Plakette** | Telefon des Gastes | Telefon antippen → Anmeldeseite öffnet sich → Name wählen → fertig |
| **QR-Aushang** | Telefon des Gastes | Code scannen → Anmeldeseite → Name wählen → fertig |
| **Kiosk** | Tablet/Laptop vor Ort | Der Kiosk scannt den QR-Code aus der Doo-Bestätigung |

Alle drei Wege schreiben in dieselbe Anwesenheitsliste. Der Kiosk ist der Rückfallweg für
Gäste ohne Smartphone; NFC und QR brauchen keinerlei Betreuung.

**Wiedereintritt** funktioniert überall: Nach dem ersten Check-in liegt ein digitaler
Ausweis im Browser des Gastes. Beim Zurückkommen genügt ein Tippen auf die Plakette — die
Anmeldung muss nicht erneut gesucht werden. Am Kiosk genügt derselbe QR-Code.

---

## Schnellstart

Voraussetzung: Docker mit Compose.

```bash
./scripts/init-env.sh      # erzeugt .env mit zufälligen Zugangsdaten
docker compose up -d --build
```

Die Anwendung läuft danach auf <http://localhost:3000>. Migrationen werden beim Start des
Containers automatisch angewendet.

Das Passwort für den Team-Bereich steht in `.env`:

```bash
grep ADMIN_PASSWORD .env
```

### Ablauf am Veranstaltungstag

1. **Veranstaltung anlegen** unter `/admin`.
2. **Gästeliste importieren** — CSV-Export aus Doo per Drag-and-drop.
3. **Zugang einrichten** — QR-Aushang als A4 drucken, NFC-Plakette beschreiben, beides am
   Eingang anbringen.
4. **Optional Kiosk** auf einem Tablet öffnen (`/kiosk/<slug>`), für Gäste ohne Smartphone.
5. **Optional Druckstation** auf dem Rechner mit dem Etikettendrucker öffnen.
6. **Veranstaltungsseite offen lassen** — Ankünfte und Hinweise laufen live ein.
7. **Danach:** Teilnahmeliste exportieren, dann die Gästedaten löschen.

---

## Funktionen im Einzelnen

### Import aus Doo

Der CSV-Export wird hochgeladen; die Spalten werden anhand ihrer Überschriften automatisch
erkannt — Vorname, Nachname, E-Mail, Organisation, Ticketcode, Tickettyp, Quelle,
Unterstützungsbedarf, Notiz. Erkannt werden gängige Schreibweisen und Umlaute, Semikolon
und Komma als Trennzeichen sowie das BOM aus Excel-Exporten.

Enthält der Export mehrere in Frage kommende Spalten, entscheidet die Genauigkeit der
Überschrift, nicht ihre Position: `Ticketcode` und `Ticket-Nr.` gehen `Bestellnummer` vor,
weil nur der Ticketcode im QR-Code des Gastes steckt. Gibt es ausschließlich eine
Bestellnummer, wird diese als Schlüssel verwendet.

Ein erneuter Import aktualisiert die Stammdaten, **ohne bereits erfasste Anwesenheiten zu
verlieren** (Upsert über Veranstaltung + Ticketcode). Zeilen ohne Ticketcode bleiben über
die Namenssuche auffindbar.

Eine Beispieldatei zum Ausprobieren liegt unter `examples/doo-export-beispiel.csv`
(20 erfundene Gäste, verschiedene Organisationen, teils mit Unterstützungsbedarf).

### Namensschilder

Die **Druckstation** (`/admin/events/<id>/drucken`) wird auf dem Rechner geöffnet, an dem
der Etikettendrucker hängt. Sie fragt laufend ab, wer eingecheckt ist und noch kein Schild
bekommen hat, und druckt automatisch — unabhängig davon, ob der Gast per NFC, QR, Kiosk
oder durch das Team eingecheckt wurde.

Das Schild ist auf 90 × 54 mm ausgelegt und zeigt Name und Organisation. Für
unterbrechungsfreien Betrieb im Browser „ohne Dialog drucken“ aktivieren; ohne diese
Einstellung funktioniert alles genauso, nur mit einer Bestätigung pro Ausdruck.

### Unterstützungsbedarf

Meldet eine Person bei der Anmeldung Unterstützung an (rollstuhlgerechter Zugang,
Verdolmetschung, Begleitperson …), löst ihr Check-in im Team-Bereich sofort aus:

- einen Einblender am unteren Bildschirmrand,
- einen kurzen Signalton,
- eine Systembenachrichtigung des Betriebssystems (einmalig freizugeben).

Der Hinweis bleibt offen, bis jemand ihn mit „Übernommen“ quittiert. Auf dem Namensschild
erscheint lediglich ein dezentes Quadrat — der Grund steht dort nicht.

### Anwesenheitsliste

Die Gästeliste lässt sich nach *Alle / Anwesend / Ausstehend / Assistenz* filtern und
durchsuchen. Das Team kann einzelne Gäste von Hand einchecken oder einen Fehlscan
zurücknehmen. Kennzahlen (anwesend, ausstehend, Wiedereintritte, Unterstützungsbedarf) und
die Auslastung gegen die Platzkapazität aktualisieren sich alle fünf Sekunden.

### Export

Die Teilnahmeliste wird als CSV mit Anwesenheit, Zeitstempeln und Anzahl der Eintritte
ausgegeben — mit BOM und Semikolon, damit Excel sie direkt korrekt öffnet.

---

## NFC einrichten

Geeignet sind NTAG213 oder größer (Aufkleber, Karten oder Plaketten).

**Direkt aus dem Browser** (Android mit Chrome, nur über HTTPS): Im Team-Bereich unter
*Zugang am Eingang → NFC-Plakette* auf „NFC-Tag beschreiben“ tippen und den Tag auflegen.

**Mit einer App** (alle anderen Fälle):

1. Adresse im Team-Bereich kopieren.
2. In „NFC Tools“ (Android) oder einer vergleichbaren App: *Schreiben → Datensatz
   hinzufügen → URL* → Adresse einfügen.
3. Tag auflegen und schreiben.
4. Anschließend **schreibschützen**, damit die Plakette vor Ort nicht verändert werden kann.

Auf der A4-Druckvorlage ist unten rechts ein Feld vorgesehen, auf das die Plakette geklebt
werden kann — so hängen beide Wege an einer Stelle.

> **Hinweis zu iPhones:** Ab iPhone XS liest iOS NFC-Tags ohne App direkt über den
> Sperrbildschirm. Bei älteren Geräten funktioniert nur der QR-Code — deshalb sollte der
> Aushang immer beide Wege zeigen.

---

## Sicherheit und Zugangskontrolle

**Team-Bereich.** `/admin` ist durch ein Passwort geschützt (`ADMIN_PASSWORD`). Die Sitzung
läuft über ein signiertes, `httpOnly`-Cookie mit zwölf Stunden Laufzeit. Passwortvergleich
und Signaturprüfung sind zeitkonstant; Anmeldeversuche sind auf fünf pro Minute und
IP-Adresse begrenzt.

**Gästeseite.** Die mobile Anmeldeseite ist nur mit dem Zugangsschlüssel der Veranstaltung
erreichbar. Dieser steckt im QR-Code bzw. auf der NFC-Plakette, wird beim ersten Aufruf ins
Cookie übernommen und **aus der Adresszeile entfernt** — er landet also nicht in Verlauf
oder Screenshots. Über *Schlüssel erneuern* lassen sich alle ausgehängten Codes und
beschriebenen Plaketten auf einen Schlag ungültig machen.

**Suche.** Um zu verhindern, dass die Gästeliste über die Suchfunktion abgeschöpft wird:
mindestens drei Zeichen, höchstens fünf bis sechs Treffer (darüber wird zur präziseren
Eingabe aufgefordert statt Ergebnisse auszuspielen), E-Mail-Adressen werden verkürzt
angezeigt, und alle Endpunkte sind mengenbegrenzt.

**Protokoll.** Von gescannten Codes wird nur ein gekürzter Hinweis gespeichert
(`AB…89 (12)`) — genug zur Fehlersuche, zu wenig zur Wiederverwendung.

**Container.** Die Anwendung läuft als unprivilegierter Nutzer, ohne
Privilegien-Eskalation, die Datenbank ist standardmäßig nicht nach außen veröffentlicht.

### Zugangsdaten

Alle Zugangsdaten stehen ausschließlich in `.env` — diese Datei ist über `.gitignore`
ausgeschlossen (`chmod 600`). Im Repository und im Docker-Image liegt **kein einziger
Zugangswert**:

- `docker-compose.yml` enthält nur Variablenreferenzen.
- Die Datenbankadresse wird zur Laufzeit aus `DB_HOST`/`DB_NAME`/`DB_USER`/`DB_PASSWORD`
  zusammengesetzt, statt als fertiger String mit eingebettetem Passwort herumzuliegen.
- Der Build braucht keine Zugangsdaten, weil die Datenbankverbindung erst beim ersten
  Zugriff aufgebaut wird.

Fehlt ein Pflichtwert, bricht Compose mit einer klaren Meldung ab, statt mit einem
unsicheren Standardwert zu starten.

---

## Datenschutz

Die Anwendung verarbeitet personenbezogene Daten der angemeldeten Gäste (Name, E-Mail,
Organisation, gegebenenfalls Angaben zum Unterstützungsbedarf). Dafür gilt:

- Die Daten verlassen den Server nicht — es gibt keine externen Dienste, kein Tracking,
  keine Analyse-Skripte und keine externen Schriftarten.
- Auf dem Namensschild erscheint kein Hinweis auf den Grund des Unterstützungsbedarfs.
- Der Kiosk zeigt nur, *dass* Unterstützung angemeldet ist, nie die Einzelheiten.
- Angaben zum Unterstützungsbedarf können Gesundheitsdaten nach Art. 9 DSGVO sein. Der
  Zugriff auf den Team-Bereich sollte entsprechend eng gehalten werden.
- Nach der Veranstaltung: Teilnahmeliste exportieren, dann unter *Daten → Gästedaten
  löschen* die personenbezogenen Daten entfernen. Die Veranstaltung mit ihren Kennzahlen
  bleibt dabei bestehen.
- Datenbank-Sicherungen enthalten Gästedaten und sind entsprechend zu behandeln; `*.dump`
  und `/backups/` sind vorsorglich aus der Versionierung ausgeschlossen.

Die Seiten sind über `robots.txt` und `X-Robots-Tag` von Suchmaschinen ausgenommen.

---

## Entwicklung ohne Docker

```bash
npm install
cp .env.example .env          # Werte ausfüllen
# In .env den Abschnitt "Lokale Entwicklung ohne Docker" einkommentieren.
# Dazu in docker-compose.yml die auskommentierte "ports"-Zeile des db-Service
# aktivieren, damit Postgres vom Host erreichbar ist.

docker compose up -d db
npm run db:migrate
npm run db:seed               # optional: 80 frei erfundene Testgäste
npm run dev
```

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run build` | Produktionsbuild |
| `npm run typecheck` | TypeScript prüfen |
| `npm run db:generate` | Migration aus dem Schema erzeugen |
| `npm run db:migrate` | Migrationen anwenden |
| `npm run db:seed` | Testdaten einspielen (nur erfundene Personen) |

---

## Betrieb

**Kamera und NFC brauchen HTTPS.** Auf `localhost` funktioniert beides ohne Zertifikat,
auf jeder anderen Adresse nicht. Für den echten Betrieb gehört ein Reverse Proxy mit
TLS davor (Caddy, Traefik, nginx). `APP_URL` muss dann auf die öffentliche Adresse zeigen,
damit QR-Codes und NFC-Tags die richtige Adresse enthalten.

**Betrieb in mehreren Instanzen.** Die Mengenbegrenzung arbeitet prozesslokal. Wird hinter
einem Load Balancer skaliert, gehört sie hinter einen gemeinsamen Speicher (Redis) oder
in den Proxy.

**Sicherung.** Alles Relevante liegt im Volume `db-data`:

```bash
docker compose exec -T db pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" > backups/guestflow.sql
```

**Gesundheitsprüfung.** `/api/health` prüft die Datenbankverbindung und liefert bei
Störung HTTP 503. Der Container nutzt denselben Endpunkt.

---

## Deployment

Das Image wird in der CI gebaut und auf dem Server nur noch geladen. Es enthält
**ausschließlich die Anwendung** — die Datenbank läuft als eigener Dienst mit eigenem
Volume. Ein Deployment tauscht damit nur den Anwendungscontainer aus; die Gästedaten
bleiben unberührt.

### Image bauen (GitHub Actions)

`.github/workflows/build.yml` baut bei jedem Push auf `main` und veröffentlicht nach
`ghcr.io/<owner>/<repo>`. Zusätzliche Zugangsdaten sind nicht nötig — der automatisch
bereitgestellte `GITHUB_TOKEN` genügt. Pull Requests werden nur gebaut, nicht
veröffentlicht.

| Auslöser | Tag |
| --- | --- |
| Push auf `main` | `latest` und `sha-<commit>` |
| Git-Tag `v1.2.0` | `1.2.0`, `1.2` und `sha-<commit>` |

Vor dem Bauen läuft `npm run typecheck`; schlägt die Prüfung fehl, entsteht kein Image.

Einmalig in den Repository-Einstellungen prüfen, dass unter *Actions → General →
Workflow permissions* das Schreiben von Packages erlaubt ist. Das Package ist nach dem
ersten Lauf zunächst privat — für `docker compose pull` auf dem Server entweder auf
öffentlich stellen oder auf dem Server mit einem Token anmelden:

```bash
echo "$TOKEN" | docker login ghcr.io -u <benutzer> --password-stdin
```

### Auf dem Server einrichten

Traefik muss bereits laufen. Benötigt werden nur `docker-compose.prod.yml` und eine
`.env`.

```bash
./scripts/init-env.sh          # erzeugt .env mit zufälligen Zugangsdaten
```

Danach in `.env` die vier Werte für das Deployment eintragen:

```bash
GUESTFLOW_IMAGE=ghcr.io/<owner>/<repo>:latest
APP_DOMAIN=checkin.example.org
TRAEFIK_NETWORK=traefik        # Name prüfen mit: docker network ls
TRAEFIK_ENTRYPOINT=websecure
TRAEFIK_CERTRESOLVER=letsencrypt
```

`APP_URL` wird daraus als `https://$APP_DOMAIN` gebildet und muss nicht separat gesetzt
werden. Starten:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Die Migrationen laufen beim Start des Containers automatisch.

### Aktualisieren

```bash
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d
```

### Was Traefik sieht

Der Anwendungscontainer hängt in zwei Netzen: `guestflow` für die Datenbank und dem
externen Traefik-Netz für den Zugriff von außen. Nach außen ist **kein Port
veröffentlicht** — auch die Datenbank nicht. Die Labels setzen Host-Regel, Entrypoint
und Zertifikats-Resolver; `loadbalancer.server.port` steht fest auf `3000`, dem Port
innerhalb des Containers.

Läuft auf demselben Traefik bereits ein anderer Dienst mit dem Router-Namen
`guestflow`, sind die Label-Namen in `docker-compose.prod.yml` anzupassen.

---

## Aufbau

```
src/
├── app/
│   ├── page.tsx                    Startseite mit laufenden Veranstaltungen
│   ├── e/[slug]/                   Mobile Selbstanmeldung (QR + NFC)
│   ├── kiosk/[slug]/               Kiosk am Tablet
│   ├── badge/[guestId]/            Namensschild, 90 × 54 mm
│   ├── admin/                      Team-Bereich
│   │   └── events/[id]/
│   │       ├── aushang/            A4-Druckvorlage
│   │       └── drucken/            Druckstation
│   └── api/                        Endpunkte
├── components/                     Oberfläche
├── db/                             Schema, Migrationen, Testdaten
├── lib/                            Check-in-Logik, CSV, Auth, QR, Tokens
└── middleware.ts                   Zugangsschutz, Schlüsselübernahme
```

### Datenmodell

- **events** — Veranstaltung, Zugangsschlüssel, Schalter für die Betriebsarten
- **guests** — Gast, Anwesenheit, Anzahl der Eintritte, Ausweis-Kennung
- **scans** — Protokoll aller Vorgänge (Erstzutritt, Wiedereintritt, nicht gefunden …)

Der Erst-Check-in läuft über ein bedingtes `UPDATE … WHERE checked_in_at IS NULL`: Scannen
zwei Geräte gleichzeitig denselben Code, gewinnt genau eines den Erstzutritt, das andere
wird sauber als Wiedereintritt gewertet.

---

## Anpassen

**Schriftart.** Die Anwendung nutzt bewusst die Systemschrift — der Build bleibt damit
ohne Netzwerkzugriff reproduzierbar. Für eine eigene Schrift `next/font/local` verwenden
und `--font-sans` in `src/app/globals.css` anpassen.

**Farben und Gestaltung.** Alle Gestaltungswerte stehen als Variablen am Anfang von
`src/app/globals.css`: Flächen, Linien, eine Akzentfarbe, Signalfarben. Hell- und
Dunkelmodus teilen sich dieselben Namen.

**Format des Namensschilds.** `@page`-Regel und Maße in
`src/app/badge/[guestId]/page.tsx`.

---

## Bekannte Grenzen

- **Web NFC zum Beschreiben** funktioniert nur in Chrome auf Android. Das *Lesen* der Tags
  durch die Gäste funktioniert auf allen aktuellen Telefonen — für das Beschreiben gibt es
  den Weg über eine App.
- **Kein Live-Push:** Team-Bereich und Druckstation fragen im Abstand von vier bis fünf
  Sekunden ab. Für die Größenordnung einer Veranstaltung ist das ausreichend und deutlich
  robuster als eine dauerhafte Verbindung im Veranstaltungs-WLAN.
- **Ein gemeinsames Passwort** für den Team-Bereich, keine Einzelkonten. Für mehrere
  Personen mit unterschiedlichen Rechten wäre eine echte Nutzerverwaltung nötig.
- **Keine Doo-Anbindung:** Die Übergabe läuft über den CSV-Export. Eine automatische
  Verknüpfung ist von Doo nicht vorgesehen.
