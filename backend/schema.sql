-- Run once to set up the database schema:
--   psql $DATABASE_URL -f schema.sql

CREATE TABLE IF NOT EXISTS users (
  id             SERIAL PRIMARY KEY,
  email          VARCHAR(255) NOT NULL,
  username       VARCHAR(50)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,
  silver_balance INTEGER      NOT NULL DEFAULT 0,
  email_verified BOOLEAN      NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT silver_non_negative CHECK (silver_balance >= 0)
);

-- Case-insensitive uniqueness enforced via expression indexes
-- (inline UNIQUE(expr) in CREATE TABLE requires PG 15+; use indexes for compat)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email_lower
  ON users (LOWER(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_lower
  ON users (LOWER(username));
