-- ============================================
-- Migration: Banking V2 - Categorisation & Splits
-- Run this in Supabase SQL Editor ONCE
-- ============================================

-- Add COA link to bank_transactions for single-account categorisation
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS coa_account_id INTEGER REFERENCES chart_of_accounts(id) ON DELETE SET NULL;

-- Table for itemised / split transactions
CREATE TABLE IF NOT EXISTS bank_transaction_splits (
    id SERIAL PRIMARY KEY,
    bank_transaction_id INTEGER REFERENCES bank_transactions(id) ON DELETE CASCADE,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    coa_account_id INTEGER REFERENCES chart_of_accounts(id) ON DELETE SET NULL,
    amount DECIMAL(12,2) NOT NULL,
    description VARCHAR(500) DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_bt_splits_txn ON bank_transaction_splits(bank_transaction_id);
CREATE INDEX IF NOT EXISTS idx_bt_splits_company ON bank_transaction_splits(company_id);
