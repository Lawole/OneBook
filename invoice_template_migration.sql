-- Add invoice_template column to companies table
ALTER TABLE companies ADD COLUMN IF NOT EXISTS invoice_template VARCHAR(50) DEFAULT 'classic';
