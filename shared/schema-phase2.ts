/**
 * Phase 2 Schema Extensions
 * New tables and fields for enhanced configuration
 */

import { pgTable, text, integer, decimal, uuid, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { negotiations } from "./schema.js";

// Products table - multiple products per negotiation
export const products = pgTable("products", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  produktName: text("produkt_name").notNull(),
  zielPreis: decimal("ziel_preis", { precision: 15, scale: 4 }).notNull(),
  minMaxPreis: decimal("min_max_preis", { precision: 15, scale: 4 }).notNull(), // Role-dependent: Min for Seller, Max for Buyer
  geschätztesVolumen: integer("geschätztes_volumen").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Übergreifende Konditionen - flexible dimensions like delivery time, payment terms
export const uebergreifendeKonditionen = pgTable("uebergreifende_konditionen", {
  id: uuid("id").primaryKey().defaultRandom(),
  negotiationId: uuid("negotiation_id").references(() => negotiations.id, { onDelete: "cascade" }).notNull(),
  name: text("name").notNull(), // e.g. "Lieferzeit", "Zahlungsziel"
  einheit: text("einheit"), // e.g. "Tage", "Monate", "%"
  minWert: decimal("min_wert", { precision: 15, scale: 4 }), // Optional, role-dependent
  maxWert: decimal("max_wert", { precision: 15, scale: 4 }), // Optional, role-dependent
  zielWert: decimal("ziel_wert", { precision: 15, scale: 4 }).notNull(),
  priorität: integer("priorität").notNull(), // 1=Must-have, 2=Wichtig, 3=Flexibel
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const productsRelations = relations(products, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [products.negotiationId],
    references: [negotiations.id],
  }),
}));

export const uebergreifendeKonditionenRelations = relations(uebergreifendeKonditionen, ({ one }) => ({
  negotiation: one(negotiations, {
    fields: [uebergreifendeKonditionen.negotiationId],
    references: [negotiations.id],
  }),
}));

// Insert schemas for validation
export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
  createdAt: true,
});

export const insertUebergreifendeKonditionSchema = createInsertSchema(uebergreifendeKonditionen).omit({
  id: true,
  createdAt: true,
});

// TypeScript types
export type Product = typeof products.$inferSelect;
export type InsertProduct = typeof products.$inferInsert;

export type UebergreifendeKondition = typeof uebergreifendeKonditionen.$inferSelect;
export type InsertUebergreifendeKondition = typeof uebergreifendeKonditionen.$inferInsert;

// Extended Negotiation fields (these will be added to existing negotiations table via migration)
export interface Phase2NegotiationFields {
  companyKnown: boolean;           // Ist das Unternehmen bekannt?
  counterpartKnown: boolean;       // Ist der Verhandlungspartner bekannt?
  negotiationFrequency: 'yearly' | 'quarterly' | 'monthly' | 'ongoing';
  powerBalance: number;            // 0-100: 0=Seller Power, 50=Balanced, 100=Buyer Power
  verhandlungsModus: 'kooperativ' | 'moderat' | 'aggressiv' | 'sehr-aggressiv';
  beschreibungGegenseite: string;  // Freitext-Beschreibung der Gegenseite
  wichtigerKontext: string;        // Wichtiger Kontext (Voice-to-Text möglich)
}
