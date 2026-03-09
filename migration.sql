-- ============================================
-- Migration: Add password_hash to companies
-- Run this in Supabase SQL Editor ONCE
-- ============================================

ALTER TABLE companies ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255);

-- Make email unique so two accounts can't share the same email
CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_email_unique ON companies(email) WHERE email IS NOT NULL;

-- ============================================
-- Migration: Banking Module
-- Run this in Supabase SQL Editor ONCE
-- ============================================

CREATE TABLE IF NOT EXISTS bank_accounts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    bank_name VARCHAR(255),
    account_number VARCHAR(100),
    account_type VARCHAR(50) DEFAULT 'checking',
    current_balance DECIMAL(12,2) DEFAULT 0,
    currency_code VARCHAR(10) DEFAULT 'USD',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS bank_transactions (
    id SERIAL PRIMARY KEY,
    bank_account_id INTEGER REFERENCES bank_accounts(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    description VARCHAR(500) NOT NULL,
    amount DECIMAL(12,2) NOT NULL,
    type VARCHAR(10) NOT NULL,
    status VARCHAR(20) DEFAULT 'unmatched',
    matched_type VARCHAR(20),
    matched_id INTEGER,
    category VARCHAR(100),
    notes TEXT,
    reference VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_company ON bank_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_status ON bank_transactions(status);
