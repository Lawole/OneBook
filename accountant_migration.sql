-- ============================================================
-- OneBooks: Accountant Module Migration
-- Run this ONCE in your Supabase SQL Editor
-- ============================================================

-- ── 1. Chart of Accounts ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS chart_of_accounts (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('Asset','Liability','Equity','Revenue','Expense')),
    category VARCHAR(100),
    balance DECIMAL(14,2) DEFAULT 0,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_coa_company ON chart_of_accounts(company_id);
CREATE INDEX IF NOT EXISTS idx_coa_type    ON chart_of_accounts(type);

-- ── 2. Manual Journal Entries ─────────────────────────────────
CREATE TABLE IF NOT EXISTS journal_entries (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    reference VARCHAR(50) NOT NULL,
    date DATE NOT NULL,
    description TEXT,
    status VARCHAR(10) DEFAULT 'draft' CHECK (status IN ('draft','posted')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (company_id, reference)
);

CREATE TABLE IF NOT EXISTS journal_lines (
    id SERIAL PRIMARY KEY,
    journal_id INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    account_code VARCHAR(20),
    account_name VARCHAR(255),
    type VARCHAR(6) CHECK (type IN ('debit','credit')),
    amount DECIMAL(14,2) NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_journal_entries_company ON journal_entries(company_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_journal   ON journal_lines(journal_id);

-- ── 3. Budgets ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(10) DEFAULT 'active' CHECK (status IN ('active','inactive','archived')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS budget_lines (
    id SERIAL PRIMARY KEY,
    budget_id INTEGER REFERENCES budgets(id) ON DELETE CASCADE,
    account_code VARCHAR(20),
    account_name VARCHAR(255),
    category VARCHAR(20) CHECK (category IN ('Revenue','Expense')),
    jan DECIMAL(14,2) DEFAULT 0,
    feb DECIMAL(14,2) DEFAULT 0,
    mar DECIMAL(14,2) DEFAULT 0,
    apr DECIMAL(14,2) DEFAULT 0,
    may DECIMAL(14,2) DEFAULT 0,
    jun DECIMAL(14,2) DEFAULT 0,
    jul DECIMAL(14,2) DEFAULT 0,
    aug DECIMAL(14,2) DEFAULT 0,
    sep DECIMAL(14,2) DEFAULT 0,
    oct DECIMAL(14,2) DEFAULT 0,
    nov DECIMAL(14,2) DEFAULT 0,
    dec DECIMAL(14,2) DEFAULT 0,
    annual_total DECIMAL(14,2) GENERATED ALWAYS AS
        (jan+feb+mar+apr+may+jun+jul+aug+sep+oct+nov+dec) STORED,
    actual_to_date DECIMAL(14,2) DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_budgets_company ON budgets(company_id);
CREATE INDEX IF NOT EXISTS idx_budget_lines_budget ON budget_lines(budget_id);

-- ── 4. FX / Currency Adjustments ─────────────────────────────
CREATE TABLE IF NOT EXISTS fx_adjustments (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    from_currency VARCHAR(10) NOT NULL,
    to_currency VARCHAR(10) NOT NULL,
    exchange_rate DECIMAL(16,6) NOT NULL,
    affected_accounts TEXT,          -- comma-separated account codes
    adjustment_amount DECIMAL(14,2) NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_fx_adjustments_company ON fx_adjustments(company_id);

-- ── 5. Invoice discount / VAT columns (if not already present) ──
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS discount_percent DECIMAL(5,2) DEFAULT 0;
ALTER TABLE invoices ADD COLUMN IF NOT EXISTS vat_rate         DECIMAL(5,2) DEFAULT 0;

-- ── Done ──────────────────────────────────────────────────────
-- After running this migration, the backend will seed a default
-- Chart of Accounts for every company automatically on first load.
