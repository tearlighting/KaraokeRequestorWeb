# Phase 8 durable submission migration record

Status: approved by the user; isolated equivalence tests passed; additive table migration applied to the existing database before enabling Node ownership.

The production migration and Node ownership switch have now been executed as documented below.

## Why existing columns are insufficient

`requesttable` has no submission identity. Identical singer/file/options may legitimately be requested twice. Its id is known only after INSERT; rows can later be deleted. History is append-only selection history, not a unique submission ledger, and replacement creates no history. Neither matching queue text nor an in-memory Map can distinguish a lost response from a new reservation across restarts.

## Proposed bounded change

Add **one table in the existing queue SQLite file**, without altering existing tables, indices or media/search schemas. Publish reviewed SQL and an explicit migration command; do not run DDL during API startup or automatically rebuild databases. Test DDL only in disposable fixtures after approval; applying it to the deployed database requires the approved explicit step and a stopped/serialized writer window.

```sql
CREATE TABLE request_submission (
  key_hash TEXT PRIMARY KEY CHECK(length(key_hash)=64),
  input_hash TEXT NOT NULL CHECK(length(input_hash)=64),
  owner_id TEXT NOT NULL,
  request_id INTEGER NOT NULL,
  operation TEXT NOT NULL CHECK(operation IN ('create','replace')),
  committed_at INTEGER NOT NULL,
  result_json TEXT NOT NULL
);
```

The server issues a cryptographically random submission receipt. Store only its hash, a canonical input hash and the minimal result (id, operation, committed status), never passwords, media metadata, Bridge credentials or a duplicate queue. INSERT/UPDATE + automatic placement + required history + ledger entry commit in **one BEGIN IMMEDIATE transaction**. Competing identical receipts serialize; matching input returns the same result without repeating writes/history/notification; different input returns 409. Deleting a queue row does not delete its receipt, so replay cannot recreate it. No automatic ledger expiry in this phase; expiry would weaken replay protection and needs an explicit retention decision.

Existing user authentication, admin roles and CSRF rules remain required. The high-entropy receipt additionally acts as a narrowly scoped bearer capability for replay/result-id lookup after reauthentication following a Node restart. It does not authorize reading a secret song, changing ownership, or accessing admin operations. Receipt replay preserves the original committed identity. Do not put receipts in URLs/logs; clients retain them until the outcome is resolved and reuse them after a network error. This limited receipt authorization is part of the requested approval, not an implicit extension of Legacy read tickets.

Metadata is obtained before the main transaction through a bounded, read-only Legacy call. Missing/unavailable metadata must have an explicit policy/result rather than throwing after an untracked commit. Notification remains after commit in its existing separate database; report committed plus notification failure, never repeat the queue transaction. Exactly-once notification across a process crash is **not** guaranteed by this table; that would require an outbox/ack protocol. Do not claim otherwise.

## Migration and validation record

The explicit CLI migration is idempotent and runs only against an already-existing queue database. It uses `BEGIN IMMEDIATE`, verifies `requesttable`, creates the additive ledger only if absent, checks the exact columns, and commits. The API server never runs it during startup. The actual migration completed; read-only before/after summaries both reported one queue row (id 3), and the new table has the seven columns listed above. No existing queue rows changed. Credentials and actual config were not included in output.

The synthetic suite compares the original PHP `exec.php` business body with Node using disposable database files, including normal create/replace, history, identity, defaults, secret values, concurrent duplicate receipts and injected history failure. Production mode now routes `/exec.php` through the authenticated compatibility forwarder when `YUKARI_NODE_REQUESTS=1`; PHP-owned mode remains available only when explicitly disabled for a separate legacy deployment.
