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

export function parseCsv(input: string, delimiter?: string): string[][] {
  const text = input.replace(/^﻿/, "");
  const delim = delimiter ?? detectDelimiter(text);
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (inQuotes) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += char;
      continue;
    }
    if (char === '"') inQuotes = true;
    else if (char === delim) {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char !== "\r") field += char;
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ""));
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
  ticketType: ["tickettyp", "tickettype", "kategorie", "ticketkategorie", "ticketart"],
  notes: ["notiz", "notizen", "notes", "bemerkung", "kommentar", "anmerkung"],
};

export type ColumnMapping = Partial<Record<keyof typeof FIELD_ALIASES, number>>;

export function mapColumns(headerRow: string[]): ColumnMapping {
  const normalized = headerRow.map(normalizeHeader);
  const mapping: ColumnMapping = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    // Exakter Treffer geht vor, sonst "enthält" — "Name" darf nicht "Vorname" kapern.
    let index = normalized.findIndex((h) => aliases.includes(h));
    if (index === -1) {
      index = normalized.findIndex((h) => h.length > 3 && aliases.some((a) => h.includes(a)));
    }
    if (index !== -1) mapping[field as keyof ColumnMapping] = index;
  }
  return mapping;
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

export function parseGuestList(csvText: string): ParsedImport {
  const rows = parseCsv(csvText);
  if (rows.length === 0) {
    return { rows: [], headers: [], mapping: {}, skipped: [] };
  }
  const [headerRow, ...dataRows] = rows;
  const mapping = mapColumns(headerRow);
  const skipped: { line: number; reason: string }[] = [];
  const parsed: ImportRow[] = [];
  const seen = new Set<string>();

  dataRows.forEach((cells, i) => {
    const line = i + 2; // +1 Header, +1 für 1-basierte Zeilen
    const at = (field: keyof ColumnMapping) => {
      const index = mapping[field];
      return index === undefined ? null : clean(cells[index]);
    };

    const lastName = at("lastName");
    const firstName = at("firstName");
    if (!lastName && !firstName) {
      skipped.push({ line, reason: "Kein Name in der Zeile" });
      return;
    }

    // Ohne Ticketcode bleibt die Person per Namenssuche auffindbar.
    const ticketCode = at("ticketCode") ?? `manuell-${line}-${(lastName ?? firstName)!.slice(0, 12)}`;
    const key = ticketCode.toLowerCase();
    if (seen.has(key)) {
      skipped.push({ line, reason: `Ticketcode "${ticketCode}" doppelt in der Datei` });
      return;
    }
    seen.add(key);

    parsed.push({
      ticketCode,
      firstName: firstName ?? "",
      lastName: lastName ?? firstName ?? "",
      email: at("email")?.toLowerCase() ?? null,
      organization: at("organization"),
      source: at("source"),
      supportNeeds: at("supportNeeds"),
      ticketType: at("ticketType"),
      notes: at("notes"),
    });
  });

  return { rows: parsed, headers: headerRow, mapping, skipped };
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
