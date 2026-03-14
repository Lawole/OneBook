-- ============================================
-- Migration: Files Module
-- Run this in Supabase SQL Editor ONCE
-- ============================================

-- User-defined file sections (folders)
CREATE TABLE IF NOT EXISTS file_sections (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    color VARCHAR(20) DEFAULT '#3b82f6',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Files stored in each section
CREATE TABLE IF NOT EXISTS files (
    id SERIAL PRIMARY KEY,
    company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
    section_id INTEGER REFERENCES file_sections(id) ON DELETE SET NULL,
    name VARCHAR(500) NOT NULL,
    original_name VARCHAR(500),
    reference VARCHAR(255),
    url TEXT NOT NULL,
    storage_path TEXT,
    mime_type VARCHAR(100),
    size_bytes INTEGER DEFAULT 0,
    source_type VARCHAR(50) DEFAULT 'manual',  -- 'manual' | 'bank_transaction'
    source_id INTEGER,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Link receipts to banking transactions
ALTER TABLE bank_transactions ADD COLUMN IF NOT EXISTS receipt_file_id INTEGER REFERENCES files(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_files_company  ON files(company_id);
CREATE INDEX IF NOT EXISTS idx_files_section  ON files(section_id);
CREATE INDEX IF NOT EXISTS idx_file_sections_company ON file_sections(company_id);
