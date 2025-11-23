-- Add playbook columns to negotiations table
ALTER TABLE negotiations 
ADD COLUMN playbook TEXT,
ADD COLUMN playbook_generated_at TIMESTAMP WITH TIME ZONE;
