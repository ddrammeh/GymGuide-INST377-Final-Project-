-- ─────────────────────────────────────────────────────
-- GymGuide — Supabase Database Setup
-- Run this entire file in the Supabase SQL Editor
-- Project: https://supabase.com → SQL Editor → New Query
-- ─────────────────────────────────────────────────────

-- TABLE 1: routines
-- Stores user-created workout routines
CREATE TABLE IF NOT EXISTS routines (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE 2: routine_exercises
-- Individual exercises within a routine (with sets/reps config)
CREATE TABLE IF NOT EXISTS routine_exercises (
  id SERIAL PRIMARY KEY,
  routine_id INT REFERENCES routines(id) ON DELETE CASCADE,
  exercise_id VARCHAR(100) NOT NULL,
  exercise_name VARCHAR(255),
  exercise_order INT NOT NULL DEFAULT 1,
  sets INT DEFAULT 3,
  reps INT DEFAULT 10,
  rest_seconds INT DEFAULT 60,
  notes TEXT
);

-- TABLE 3: workout_logs
-- Tracks when a routine was completed
CREATE TABLE IF NOT EXISTS workout_logs (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  routine_id INT REFERENCES routines(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  notes TEXT
);

-- TABLE 4: exercise_cache (optional — for caching ExerciseDB responses)
CREATE TABLE IF NOT EXISTS exercise_cache (
  id SERIAL PRIMARY KEY,
  exercise_id VARCHAR(100) UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  body_part VARCHAR(100),
  target_muscle VARCHAR(100),
  equipment VARCHAR(100),
  gif_url TEXT,
  instructions TEXT,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- TABLE 5: favorites
CREATE TABLE IF NOT EXISTS favorites (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(255) NOT NULL,
  exercise_id VARCHAR(100) NOT NULL,
  exercise_name VARCHAR(255),
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(session_id, exercise_id)
);

-- ── Enable Row Level Security (RLS) — recommended ────
-- For this project, we allow all reads/writes since there's no auth
-- In production you'd restrict by user

ALTER TABLE routines ENABLE ROW LEVEL SECURITY;
ALTER TABLE routine_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE workout_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE exercise_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE favorites ENABLE ROW LEVEL SECURITY;

-- Allow all operations via the anon key (our backend uses service role anyway)
CREATE POLICY "Allow all for anon" ON routines FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON routine_exercises FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON workout_logs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON exercise_cache FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all for anon" ON favorites FOR ALL USING (true) WITH CHECK (true);

-- ── Done! ─────────────────────────────────────────────
-- After running, go to Table Editor to confirm all 5 tables exist.
