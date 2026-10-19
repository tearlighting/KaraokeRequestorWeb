-- Explicitly approved Phase 8 addition. Never executed during API startup.
CREATE TABLE request_submission (
  key_hash TEXT PRIMARY KEY CHECK(length(key_hash)=64),
  input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
  owner_id TEXT NOT NULL,
  request_id INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create','replace')),
  committed_at INTEGER NOT NULL,
  result_json TEXT NOT NULL
);
