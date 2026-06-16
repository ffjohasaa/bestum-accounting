-- Years / opening balances
CREATE TABLE IF NOT EXISTS years (
  year        INTEGER PRIMARY KEY,
  opening_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Chart of accounts (kontoplan)
CREATE TABLE IF NOT EXISTS accounts (
  id          SERIAL PRIMARY KEY,
  code        VARCHAR(10) NOT NULL UNIQUE,
  name        VARCHAR(100) NOT NULL,
  type        VARCHAR(20) NOT NULL CHECK (type IN ('Inntekt','Utgift')),
  color       VARCHAR(20),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Categorisation rules
CREATE TABLE IF NOT EXISTS rules (
  id          SERIAL PRIMARY KEY,
  source_type VARCHAR(20) NOT NULL CHECK (source_type IN ('bank_income','bank_expense','vipps')),
  match_field VARCHAR(20) DEFAULT 'combined',
  match_text  VARCHAR(200) NOT NULL,
  account_code VARCHAR(10) NOT NULL,
  description VARCHAR(200),
  priority    INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Activities (aktiviteter)
CREATE TABLE IF NOT EXISTS activities (
  id          SERIAL PRIMARY KEY,
  year        INTEGER NOT NULL,
  name        VARCHAR(200) NOT NULL,
  description TEXT,
  income_accounts TEXT[],
  expense_accounts TEXT[],
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions
CREATE TABLE IF NOT EXISTS transactions (
  id          SERIAL PRIMARY KEY,
  year        INTEGER NOT NULL,
  date        DATE NOT NULL,
  seq_nr      INTEGER,
  ref         VARCHAR(50),
  account_code VARCHAR(10),
  account_name VARCHAR(100),
  description TEXT,
  income      NUMERIC(12,2) DEFAULT 0,
  expense     NUMERIC(12,2) DEFAULT 0,
  balance     NUMERIC(12,2),
  source      VARCHAR(20) DEFAULT 'Bank',
  vipps_name  VARCHAR(200),
  vipps_message TEXT,
  receipt_url TEXT,
  receipt_note TEXT,
  reconciled  BOOLEAN DEFAULT TRUE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_transactions_year ON transactions(year);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON transactions(account_code);

-- Budgets
CREATE TABLE IF NOT EXISTS budgets (
  id          SERIAL PRIMARY KEY,
  year        INTEGER NOT NULL,
  name        VARCHAR(200) NOT NULL,
  date        DATE,
  expected_participants INTEGER DEFAULT 9,
  min_participants      INTEGER DEFAULT 6,
  max_participants      INTEGER DEFAULT 12,
  costs       JSONB DEFAULT '[]',
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Settings (per-year key/value store)
CREATE TABLE IF NOT EXISTS settings (
  year        INTEGER NOT NULL,
  key         VARCHAR(100) NOT NULL,
  value       JSONB,
  PRIMARY KEY (year, key)
);

-- Sessions (for express-session)
CREATE TABLE IF NOT EXISTS session (
  sid         VARCHAR NOT NULL COLLATE "default",
  sess        JSON NOT NULL,
  expire      TIMESTAMP(6) NOT NULL
);
ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid) NOT DEFERRABLE INITIALLY IMMEDIATE;
CREATE INDEX IF NOT EXISTS idx_session_expire ON session(expire);
