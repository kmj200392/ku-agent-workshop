CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY, nickname TEXT NOT NULL, created INTEGER NOT NULL,
  access_hash TEXT NOT NULL UNIQUE
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES participants(id), expires INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_expiry ON sessions(expires);
CREATE TABLE IF NOT EXISTS auth_attempts (
  bucket TEXT PRIMARY KEY, attempts INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS runs (
  id TEXT PRIMARY KEY, owner TEXT NOT NULL REFERENCES participants(id), request_id TEXT NOT NULL,
  code TEXT NOT NULL, hash TEXT NOT NULL, kind TEXT NOT NULL, suite TEXT NOT NULL,
  status TEXT NOT NULL, created INTEGER NOT NULL, finished INTEGER, score INTEGER,
  total INTEGER, model_calls INTEGER, tool_calls INTEGER, elapsed REAL, summary TEXT, source_id TEXT
);
CREATE INDEX IF NOT EXISTS runs_owner_created ON runs(owner, created);
CREATE INDEX IF NOT EXISTS runs_board ON runs(kind, suite, status, score);
