-- ============================================
-- Migration: Banking V3 — Auto-categorisation
-- Run this in the Supabase SQL Editor ONCE
-- ============================================

-- Unique keyword identifier per Chart of Account.
-- Used to auto-categorise imported bank transactions whose
-- description contains this token (case-insensitive).
ALTER TABLE chart_of_accounts
  ADD COLUMN IF NOT EXISTS identifier VARCHAR(100);

CREATE INDEX IF NOT EXISTS idx_coa_identifier
  ON chart_of_accounts(company_id, identifier)
  WHERE identifier IS NOT NULL AND identifier <> '';

-- Track whether a transaction was auto-categorised (vs manual)
ALTER TABLE bank_transactions
  ADD COLUMN IF NOT EXISTS auto_matched BOOLEAN DEFAULT FALSE;
