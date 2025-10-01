-- Phase 2: Schema Updates für erweiterte Konfiguration
-- Datum: 2025-10-01

-- 1. Neue Tabelle: Produkte
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  produkt_name TEXT NOT NULL,
  ziel_preis DECIMAL(15, 4) NOT NULL,
  min_max_preis DECIMAL(15, 4) NOT NULL, -- Role-dependent: Min für Seller, Max für Buyer
  geschätztes_volumen INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_negotiation_id ON products(negotiation_id);

-- 2. Neue Tabelle: Übergreifende Konditionen
CREATE TABLE IF NOT EXISTS uebergreifende_konditionen (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negotiation_id UUID NOT NULL REFERENCES negotiations(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- z.B. "Lieferzeit", "Zahlungsziel"
  einheit TEXT, -- z.B. "Tage", "Monate", "%"
  min_wert DECIMAL(15, 4), -- Optional, rollenabhängig
  max_wert DECIMAL(15, 4), -- Optional, rollenabhängig
  ziel_wert DECIMAL(15, 4) NOT NULL,
  priorität INTEGER NOT NULL CHECK (priorität IN (1, 2, 3)), -- 1=Must-have, 2=Wichtig, 3=Flexibel
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_konditionen_negotiation_id ON uebergreifende_konditionen(negotiation_id);

-- 3. Erweitere negotiations Tabelle
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS company_known BOOLEAN DEFAULT false;
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS counterpart_known BOOLEAN DEFAULT false;
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS negotiation_frequency TEXT CHECK (negotiation_frequency IN ('yearly', 'quarterly', 'monthly', 'ongoing'));
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS power_balance INTEGER DEFAULT 50 CHECK (power_balance BETWEEN 0 AND 100);
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS verhandlungs_modus TEXT DEFAULT 'moderat' CHECK (verhandlungs_modus IN ('kooperativ', 'moderat', 'aggressiv', 'sehr-aggressiv'));
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS beschreibung_gegenseite TEXT;
ALTER TABLE negotiations ADD COLUMN IF NOT EXISTS wichtiger_kontext TEXT; -- Freitext + Voice Input

-- 4. Kommentare für Dokumentation
COMMENT ON TABLE products IS 'Produkte die in einer Verhandlung verhandelt werden (max 10 pro negotiation)';
COMMENT ON COLUMN products.min_max_preis IS 'Rollenabhängig: Minimalpreis für Verkäufer, Maximalpreis für Käufer';

COMMENT ON TABLE uebergreifende_konditionen IS 'Übergreifende Verhandlungsdimensionen wie Lieferzeit, Zahlungsziel, etc.';

COMMENT ON COLUMN negotiations.power_balance IS 'Macht-Balance: 0 = Verkäufer mächtiger, 50 = ausgeglichen, 100 = Käufer mächtiger';
COMMENT ON COLUMN negotiations.verhandlungs_modus IS 'Verhandlungsmodus der Gegenseite: kooperativ, moderat, aggressiv, sehr-aggressiv';
COMMENT ON COLUMN negotiations.wichtiger_kontext IS 'Wichtiger Verhandlungskontext (Freitext oder Voice-to-Text)';
