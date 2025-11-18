-- PostgreSQL schema for BES equipment catalogs

CREATE TABLE IF NOT EXISTS pump_catalog (
    pump_id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS motor_catalog (
    motor_id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cable_catalog (
    cable_id TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS catalog_metadata (
    key TEXT PRIMARY KEY,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pump_catalog_updated_at ON pump_catalog;
CREATE TRIGGER trg_pump_catalog_updated_at
BEFORE UPDATE ON pump_catalog
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_motor_catalog_updated_at ON motor_catalog;
CREATE TRIGGER trg_motor_catalog_updated_at
BEFORE UPDATE ON motor_catalog
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS trg_cable_catalog_updated_at ON cable_catalog;
CREATE TRIGGER trg_cable_catalog_updated_at
BEFORE UPDATE ON cable_catalog
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
