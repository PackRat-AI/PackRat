-- Migration: Add NatureLens tables for plant and wildlife identification

CREATE TABLE IF NOT EXISTS nature_identifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    image_url TEXT,
    image_local_path TEXT,
    species_name TEXT NOT NULL,
    species_common_name TEXT,
    confidence REAL NOT NULL,
    category TEXT NOT NULL CHECK (category IN ('plant', 'animal', 'bird', 'insect', 'fungus', 'other')),
    description TEXT,
    habitat TEXT,
    is_edible BOOLEAN,
    is_dangerous BOOLEAN,
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    is_offline BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nature_identifications_user_id ON nature_identifications(user_id);
CREATE INDEX IF NOT EXISTS idx_nature_identifications_created_at ON nature_identifications(created_at);
CREATE INDEX IF NOT EXISTS idx_nature_identifications_category ON nature_identifications(category);

CREATE TABLE IF NOT EXISTS nature_identification_history (
    id TEXT PRIMARY KEY,
    identification_id TEXT NOT NULL REFERENCES nature_identifications(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    viewed_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nature_history_user_id ON nature_identification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_nature_history_identification_id ON nature_identification_history(identification_id);
