-- Migration: Add Phase2 fields to negotiations table
-- Date: Januar 2025
-- Purpose: Add companyKnown, counterpartKnown, negotiationFrequency, powerBalance, verhandlungsModus

-- Add Phase2 specific fields
ALTER TABLE negotiations 
  ADD COLUMN IF NOT EXISTS company_known BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS counterpart_known BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS negotiation_frequency TEXT,
  ADD COLUMN IF NOT EXISTS power_balance INTEGER DEFAULT 50,
  ADD COLUMN IF NOT EXISTS verhandlungs_modus TEXT;

-- Add comments for documentation
COMMENT ON COLUMN negotiations.company_known IS 'Whether the company is known to the counterpart';
COMMENT ON COLUMN negotiations.counterpart_known IS 'Whether the counterpart is known';
COMMENT ON COLUMN negotiations.negotiation_frequency IS 'Frequency: yearly, quarterly, monthly, ongoing';
COMMENT ON COLUMN negotiations.power_balance IS '0-100: 0 = seller more powerful, 50 = balanced, 100 = buyer more powerful';
COMMENT ON COLUMN negotiations.verhandlungs_modus IS 'Negotiation mode: kooperativ, moderat, aggressiv, sehr-aggressiv';

