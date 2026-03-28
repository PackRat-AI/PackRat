-- Migration: Add Trail Conditions tables for SmartRoute AI

CREATE TABLE IF NOT EXISTS trail_conditions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    trail_id TEXT,
    trail_name TEXT NOT NULL,
    latitude REAL,
    longitude REAL,
    location_name TEXT,
    surface_condition TEXT CHECK (surface_condition IN ('paved', 'gravel', 'dirt', 'rocky', 'snow', 'mud')),
    difficulty INTEGER CHECK (difficulty BETWEEN 1 AND 5),
    has_fallen_trees BOOLEAN DEFAULT FALSE,
    has_wildlife BOOLEAN DEFAULT FALSE,
    has_erosion BOOLEAN DEFAULT FALSE,
    has_closures BOOLEAN DEFAULT FALSE,
    has_water_crossings BOOLEAN DEFAULT FALSE,
    water_crossing_count INTEGER,
    water_depth TEXT CHECK (water_depth IN ('shallow', 'moderate', 'deep')),
    water_difficulty TEXT CHECK (water_difficulty IN ('easy', 'moderate', 'difficult')),
    photo_urls TEXT[],
    notes TEXT,
    trust_score REAL DEFAULT 1.0,
    verified_count INTEGER DEFAULT 0,
    is_offline BOOLEAN DEFAULT FALSE,
    synced_at TIMESTAMP,
    reported_at TIMESTAMP DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trail_conditions_user_id ON trail_conditions(user_id);
CREATE INDEX IF NOT EXISTS idx_trail_conditions_trail_id ON trail_conditions(trail_id);
CREATE INDEX IF NOT EXISTS idx_trail_conditions_reported_at ON trail_conditions(reported_at);
CREATE INDEX IF NOT EXISTS idx_trail_conditions_location ON trail_conditions(latitude, longitude);

CREATE TABLE IF NOT EXISTS trail_condition_verifications (
    id TEXT PRIMARY KEY,
    condition_id TEXT NOT NULL REFERENCES trail_conditions(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    is_accururate BOOLEAN NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_trail_verifications_condition_id ON trail_condition_verifications(condition_id);
CREATE INDEX IF NOT EXISTS idx_trail_verifications_user_id ON trail_condition_verifications(user_id);
