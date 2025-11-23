-- Add Interpersonal Circumplex personality dimensions to counterparts table
-- dominance: -100 (submissive) to +100 (dominant)
-- affiliation: -100 (hostile) to +100 (friendly)

ALTER TABLE counterparts
  ADD COLUMN dominance DECIMAL(5,2) DEFAULT 0,
  ADD COLUMN affiliation DECIMAL(5,2) DEFAULT 0;

-- Add constraints to ensure valid ranges
ALTER TABLE counterparts
  ADD CONSTRAINT dominance_range CHECK (dominance >= -100 AND dominance <= 100),
  ADD CONSTRAINT affiliation_range CHECK (affiliation >= -100 AND affiliation <= 100);

-- Add comment for documentation
COMMENT ON COLUMN counterparts.dominance IS 'Interpersonal Circumplex dominance axis: -100 (submissive) to +100 (dominant)';
COMMENT ON COLUMN counterparts.affiliation IS 'Interpersonal Circumplex affiliation axis: -100 (hostile) to +100 (friendly)';
