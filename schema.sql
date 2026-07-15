-- =====================================================
-- License Management System - Supabase SQL Schema
-- Run this in your Supabase SQL Editor
-- =====================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================
-- LICENSESLIST TABLE (Main table with all required fields)
-- =====================================================
CREATE TABLE IF NOT EXISTS licenseslist (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key     TEXT UNIQUE NOT NULL,
    status          TEXT NOT NULL DEFAULT 'inactive'
                        CHECK (status IN ('active', 'inactive', 'expired', 'revoked', 'suspended')),
    device_id       TEXT,                          -- device bound to this license
    activated_at    TIMESTAMPTZ,                   -- when the license was activated
    expired_at      TIMESTAMPTZ,                   -- when the license actually expired
    expiry_date     TIMESTAMPTZ,                   -- planned expiry / validity end date
    customer_name   TEXT NOT NULL,                 -- name of the customer
    -- Extended fields
    customer_email  TEXT,
    product_name    TEXT DEFAULT 'General',
    license_type    TEXT DEFAULT 'standard'
                        CHECK (license_type IN ('trial', 'standard', 'professional', 'enterprise')),
    max_activations INTEGER DEFAULT 1,
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- AUDIT LOGS TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS audit_logs (
    id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    action       TEXT NOT NULL,
    license_id   UUID REFERENCES licenseslist(id) ON DELETE SET NULL,
    license_key  TEXT,
    details      JSONB DEFAULT '{}',
    performed_by TEXT DEFAULT 'system',
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_licenses_key        ON licenseslist(license_key);
CREATE INDEX IF NOT EXISTS idx_licenses_status     ON licenseslist(status);
CREATE INDEX IF NOT EXISTS idx_licenses_device_id  ON licenseslist(device_id);
CREATE INDEX IF NOT EXISTS idx_licenses_expiry     ON licenseslist(expiry_date);
CREATE INDEX IF NOT EXISTS idx_licenses_customer   ON licenseslist(customer_name);
CREATE INDEX IF NOT EXISTS idx_audit_license_id    ON audit_logs(license_id);

-- =====================================================
-- AUTO-UPDATE updated_at TRIGGER
-- =====================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_licenses_updated_at ON licenseslist;
CREATE TRIGGER trg_licenses_updated_at
    BEFORE UPDATE ON licenseslist
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- FUNCTION: Auto-expire licenses past expiry_date
-- =====================================================
CREATE OR REPLACE FUNCTION auto_expire_licenses()
RETURNS INTEGER AS $$
DECLARE
    affected INTEGER;
BEGIN
    UPDATE licenseslist
    SET    status = 'expired',
           expired_at = NOW()
    WHERE  status = 'active'
    AND    expiry_date IS NOT NULL
    AND    expiry_date < NOW();

    GET DIAGNOSTICS affected = ROW_COUNT;
    RETURN affected;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SAMPLE DATA
-- =====================================================
INSERT INTO licenseslist (license_key, status, customer_name, customer_email, product_name, license_type, expiry_date)
VALUES
    ('LMS-AAAAA-BBBBB-CCCCC-11111', 'active',   'Alice Johnson',  'alice@example.com',  'PhotoEditor Pro',      'professional', NOW() + INTERVAL '90 days'),
    ('LMS-DDDDD-EEEEE-FFFFF-22222', 'inactive', 'Bob Smith',      'bob@example.com',    'DataSync Enterprise',  'standard',     NOW() + INTERVAL '30 days'),
    ('LMS-GGGGG-HHHHH-IIIII-33333', 'expired',  'Carol Williams', 'carol@example.com',  'SecureVPN Plus',       'trial',        NOW() - INTERVAL '10 days'),
    ('LMS-JJJJJ-KKKKK-LLLLL-44444', 'active',   'David Brown',    'david@example.com',  'PhotoEditor Pro',      'enterprise',   NOW() + INTERVAL '365 days'),
    ('LMS-MMMMM-NNNNN-OOOOO-55555', 'revoked',  'Eve Davis',      'eve@example.com',    'DataSync Enterprise',  'standard',     NOW() + INTERVAL '60 days')
ON CONFLICT DO NOTHING;
