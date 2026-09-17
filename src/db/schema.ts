import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const scanResultEnum = pgEnum("scan_result", [
  "checked_in", // erster Einlass
  "re_entry", // Wiedereintritt, bereits eingecheckt
  "not_found", // Code/Suche ohne Treffer
  "wrong_event", // Ticket gehört zu einer anderen Veranstaltung
  "checked_out", // manuell zurückgesetzt
]);

export const scanMethodEnum = pgEnum("scan_method", [
  "qr", // Kiosk scannt das Ticket des Gastes
  "manual", // Namenssuche am Kiosk
  "staff", // Eintrag durch das Team
  "self", // Gast scannt den Aushang-QR mit dem eigenen Telefon
  "nfc", // Gast hält das Telefon an die NFC-Plakette
]);

export const events = pgTable(
  "events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    slug: text("slug").notNull(),
    name: text("name").notNull(),
    location: text("location"),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }),
    capacity: integer("capacity"),
    /** Namensschild am Kiosk anbieten */
    badgePrinting: boolean("badge_printing").notNull().default(true),
    /** Kiosk erlaubt Suche per Name/E-Mail, wenn der QR-Code nicht lesbar ist */
    manualSearch: boolean("manual_search").notNull().default(true),
    /**
     * Suche nur über die vollständige E-Mail-Adresse oder den Ticketcode.
     *
     * Ohne diesen Schalter findet eine Namenssuche auch Teiltreffer — wer
     * "Mül" eingibt, bekommt die Namen aller Müllers der Gästeliste zu sehen.
     * Ist er gesetzt, muss die Eingabe exakt passen; aus der Liste lässt sich
     * dann nichts mehr erraten, weil ein Treffer voraussetzt, dass man die
     * Adresse ohnehin schon kennt.
     */
    emailOnlyLookup: boolean("email_only_lookup").notNull().default(false),
    /** Wiedereintritt ohne erneute Prüfung zulassen */
    allowReEntry: boolean("allow_re_entry").notNull().default(true),
    /**
     * Zugangsschlüssel für den Aushang-QR-Code. Steckt in der URL, die auf dem
     * Plakat landet. Ohne ihn lässt sich die mobile Anmeldeseite nicht öffnen —
     * der Link ist damit so vertraulich wie der Aushang vor Ort.
     */
    publicToken: text("public_token").notNull(),
    /** Mobile Selbstanmeldung per Aushang-QR aktiv */
    selfServiceEnabled: boolean("self_service_enabled").notNull().default(true),
    archivedAt: timestamp("archived_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex("events_slug_idx").on(t.slug)],
);

export const guests = pgTable(
  "guests",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    /** Referenz aus Doo (Ticket-/Bestellnummer) — Inhalt des QR-Codes */
    ticketCode: text("ticket_code").notNull(),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    email: text("email"),
    organization: text("organization"),
    /** "Wie haben Sie von der Veranstaltung erfahren?" */
    source: text("source"),
    /** Barrierefreiheit, Verdolmetschung, ... — löst Team-Hinweis aus */
    supportNeeds: text("support_needs"),
    ticketType: text("ticket_type"),
    notes: text("notes"),
    checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    entryCount: integer("entry_count").notNull().default(0),
    badgePrintedAt: timestamp("badge_printed_at", { withTimezone: true }),
    /** Team-Hinweis wegen Unterstützungsbedarf quittiert */
    supportAckAt: timestamp("support_ack_at", { withTimezone: true }),
    /** Erkennungsmerkmal für den digitalen Ausweis auf dem Telefon des Gastes */
    passToken: text("pass_token"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("guests_event_ticket_idx").on(t.eventId, t.ticketCode),
    index("guests_event_name_idx").on(t.eventId, t.lastName),
    index("guests_event_email_idx").on(t.eventId, t.email),
  ],
);

export const scans = pgTable(
  "scans",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    eventId: uuid("event_id")
      .notNull()
      .references(() => events.id, { onDelete: "cascade" }),
    guestId: uuid("guest_id").references(() => guests.id, { onDelete: "cascade" }),
    result: scanResultEnum("result").notNull(),
    method: scanMethodEnum("method").notNull().default("qr"),
    /** Nur gekürzt gespeichert — reicht zur Fehlersuche, ist kein Ausweis */
    rawCodeHint: text("raw_code_hint"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("scans_event_created_idx").on(t.eventId, t.createdAt)],
);

export const eventsRelations = relations(events, ({ many }) => ({
  guests: many(guests),
  scans: many(scans),
}));

export const guestsRelations = relations(guests, ({ one, many }) => ({
  event: one(events, { fields: [guests.eventId], references: [events.id] }),
  scans: many(scans),
}));

export const scansRelations = relations(scans, ({ one }) => ({
  event: one(events, { fields: [scans.eventId], references: [events.id] }),
  guest: one(guests, { fields: [scans.guestId], references: [guests.id] }),
}));

export type Event = typeof events.$inferSelect;
export type Guest = typeof guests.$inferSelect;
export type Scan = typeof scans.$inferSelect;
export type ScanResult = (typeof scanResultEnum.enumValues)[number];
