-- ============================================
-- Migration: Add password_hash to companies
-- Run this in Supabase SQL Editor ONCE
-- ============================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Make email unique so two accounts can't share the same email
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_email_unique ON companies(email) WHERE email IS NOT NULL;
