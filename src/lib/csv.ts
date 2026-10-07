import { createHash } from "node:crypto";

import { parseImportedPin } from "@/lib/pin";

/**
 * Kleiner RFC-4180-Parser. Doo-Exporte kommen je nach Locale mit Komma oder
 * Semikolon, mit BOM und mit Feldern in Anführungszeichen — das deckt das hier ab.
 */
export function detectDelimiter(sample: string): string {
  const firstLine = sample.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let inQuotes = false;
  for (const char of firstLine) {
    if (char === '"') inQuotes = !inQuotes;
    else if (!inQuotes && char in counts) counts[char]++;
  }
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
}

/** Ein Datensatz samt der Zeile, in der er in der Datei beginnt. */
export type CsvRecord = { cells: string[]; line: number };

/**
 * Datensätze mit ihrer Position in der Datei.
 *
 * Die Zeilennummer wird mitgeführt, damit ein Hinweis auf eine fehlerhafte
 * Zeile auf die Stelle zeigt, die in Excel auch wirklich dort steht. Leerzeilen
 * und Felder mit Zeilenumbruch innerhalb von Anführungszeichen würden die
 * Zählung sonst gegenüber der Datei verschieben.
 */
export function parseCsvRecords(input: string, delimiter?: string): CsvRecord[] {
  const text = input.replace(/^﻿/, "");
  const delim = delimiter ?? detectDelimiter(text);

  const records: CsvRecord[] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let line = 1;
  let recordStart = 1;

  const closeRecord = () => {
    row.push(field);
    // Leerzeilen übergehen, aber die Zählung nicht verlieren.
    if (row.some((cell) => cell.trim() !== "")) records.push({ cells: row, line: recordStart });
    row = [];
    field = "";
  };

  for (let i = 0; i < text.length; i++) {
    const char = text[i];

    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else {
        if (char === "\n") line++;
        field += char;
      }
      continue;
    }

    if (char === '"') inQuotes = true;
    else if (char === delim) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      closeRecord();
      line++;
      recordStart = line;
    } else if (char !== "\r") field += char;
  }

  if (field.length > 0 || row.length > 0) closeRecord();
  return records;
}

export function parseCsv(input: string, delimiter?: string): string[][] {
  return parseCsvRecords(input, delimiter).map((record) => record.cells);
}

/** Spaltenüberschriften auf einen Vergleichsschlüssel normalisieren. */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]/g, "");
}

/** Bekannte Schreibweisen aus Doo und typischen Excel-Listen. */
const FIELD_ALIASES: Record<string, string[]> = {
  ticketCode: [
    "ticketcode", "code", "barcode", "qrcode", "ticketid", "ticketnummer",
    "ticketnr", "bestellnummer", "ordernumber", "referenz", "reference", "id",
  ],
  firstName: ["vorname", "firstname", "givenname", "first"],
  lastName: ["nachname", "name", "lastname", "surname", "familyname", "last"],
  email: ["email", "emailadresse", "mail", "emailaddress"],
  organization: ["organisation", "organization", "firma", "company", "institution", "unternehmen"],
  source: ["quelle", "source", "wiehabensievonderveranstaltungerfahren", "aufmerksamgeworden", "kanal"],
  supportNeeds: [
    "unterstuetzungsbedarf", "unterstuetzung", "barrierefreiheit", "accessibility",
    "support", "supportneeds", "assistenz", "verdolmetschung", "besonderebeduerfnisse",
  ],
  ticketType: ["tickettyp", "tickettype", "ticketkategorie", "ticketart", "kategorie"],
  pin: ["pin", "pincode", "pinnummer", "checkinpin", "zugangspin", "zugangscode"],
  notes: ["notiz", "notizen", "notes", "bemerkung", "kommentar", "anmerkung"],
};

export type ColumnMapping = Partial<Record<keyof typeof FIELD_ALIASES, number>>;

export function mapColumns(headerRow: string[]): ColumnMapping {
  const normalized = headerRow.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  const claimed = new Set<number>();

  // Erst alle exakten Treffer, dann erst die unscharfen. Sonst griffe sich ein
  // frueher Alias per "enthaelt" eine Spalte, die spaeter exakt passen wuerde:
  // "PIN-Code" enthaelt "code" und landete als Ticketcode, obwohl "pin" exakt
  // passt. Eine belegte Spalte wird nicht erneut vergeben.
  for (const exact of [true, false]) {
    for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
      if (mapping[field as keyof ColumnMapping] !== undefined) continue;

      // Innerhalb eines Feldes entscheidet die Reihenfolge der Aliasse, nicht
      // die der Spalten: Doo exportiert Bestellnummer und Ticket-Nr.
      // nebeneinander, und nur die Ticket-Nr. steckt im QR-Code. Stuende die
      // Bestellnummer weiter links, wuerde sie als Ticketcode gespeichert - die
      // Bestellnummer wiederholt sich bei Sammelbestellungen, es blieben also
      // Gaeste als Dubletten liegen.
      const index = findByAlias(normalized, aliases, claimed, (header, alias) =>
        exact ? header === alias : header.length > 3 && header.includes(alias),
      );
      if (index !== -1) {
        mapping[field as keyof ColumnMapping] = index;
        claimed.add(index);
      }
    }
  }

  return mapping;
}

/** Erster freier Spaltentreffer fuer den am hoechsten priorisierten Alias. */
function findByAlias(
  headers: string[],
  aliases: string[],
  claimed: Set<number>,
  matches: (header: string, alias: string) => boolean,
): number {
  for (const alias of aliases) {
    const index = headers.findIndex((header, i) => !claimed.has(i) && matches(header, alias));
    if (index !== -1) return index;
  }
  return -1;
}

export type ImportRow = {
  ticketCode: string;
  firstName: string;
  lastName: string;
  email: string | null;
  organization: string | null;
  source: string | null;
  supportNeeds: string | null;
  ticketType: string | null;
  pin: string | null;
  notes: string | null;
};

export type ParsedImport = {
  rows: ImportRow[];
  headers: string[];
  mapping: ColumnMapping;
  skipped: { line: number; reason: string }[];
};

const clean = (value: string | undefined): string | null => {
  const trimmed = (value ?? "").trim();
  return trimmed === "" || trimmed === "-" ? null : trimmed;
};

/**
 * Ersatzschlüssel für Zeilen ohne Ticketcode.
 *
 * Er muss aus dem Inhalt der Zeile folgen, nicht aus ihrer Position: Der Import
 * gleicht über (Veranstaltung, Ticketcode) ab, damit ein zweiter Import die
 * Stammdaten aktualisiert statt Dubletten anzulegen. Eine Zeilennummer ändert
 * sich aber, sobald jemand eine Nachmeldung oben in die Liste einfügt — dann
 * wäre jeder Gast ohne Ticketcode doppelt in der Anwesenheitsliste, die Kopie
 * mit Status "nicht da".
 *
 * Die E-Mail-Adresse ist der beste Anker; fehlt sie, dient ein Hash aus Name
 * und Organisation. Beide bleiben über Exporte hinweg stabil.
 */
function fallbackTicketCode(row: {
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  organization: string | null;
}): string {
  if (row.email) return `auto:mail:${row.email}`;

  const basis = [row.lastName, row.firstName, row.organization]
    .map((part) => (part ?? "").trim().toLowerCase())
    .join("|");
  const digest = createHash("sha256").update(basis).digest("hex").slice(0, 16);
  return `auto:name:${digest}`;
}

export function parseGuestList(csvText: string): ParsedImport {
  const records = parseCsvRecords(csvText);
  if (records.length === 0) {
    return { rows: [], headers: [], mapping: {}, skipped: [] };
  }

  const [headerRecord, ...dataRecords] = records;
  const mapping = mapColumns(headerRecord.cells);
  const skipped: { line: number; reason: string }[] = [];
  const parsed: ImportRow[] = [];
  const seen = new Map<string, number>();

  for (const { cells, line } of dataRecords) {
    const at = (field: keyof ColumnMapping) => {
      const index = mapping[field];
      return index === undefined ? null : clean(cells[index]);
    };

    const lastName = at("lastName");
    const firstName = at("firstName");
    if (!lastName && !firstName) {
      skipped.push({ line, reason: "Kein Name in der Zeile" });
      continue;
    }

    const email = at("email")?.toLowerCase() ?? null;
    const organization = at("organization");

    // Ohne Ticketcode bleibt die Person über Name bzw. E-Mail auffindbar.
    const ticketCode =
      at("ticketCode") ?? fallbackTicketCode({ email, firstName, lastName, organization });

    const key = ticketCode.toLowerCase();
    const firstOccurrence = seen.get(key);
    if (firstOccurrence !== undefined) {
      skipped.push({
        line,
        reason: `Dieselbe Person steht schon in Zeile ${firstOccurrence}`,
      });
      continue;
    }
    seen.set(key, line);

    parsed.push({
      ticketCode,
      firstName: firstName ?? "",
      lastName: lastName ?? firstName ?? "",
      email,
      organization,
      source: at("source"),
      supportNeeds: at("supportNeeds"),
      ticketType: at("ticketType"),
      pin: parseImportedPin(at("pin")),
      notes: at("notes"),
    });
  }

  return { rows: parsed, headers: headerRecord.cells, mapping, skipped };
}

export function toCsv(headers: string[], rows: (string | number | null)[][]): string {
  const escape = (value: string | number | null) => {
    const str = value === null || value === undefined ? "" : String(value);
    return /[",;\n\r]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };
  const lines = [headers.map(escape).join(";"), ...rows.map((r) => r.map(escape).join(";"))];
  // BOM, damit Excel UTF-8 erkennt.
  return `﻿${lines.join("\r\n")}\r\n`;
}
