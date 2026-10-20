CREATE TABLE playback_task (
  task_id TEXT PRIMARY KEY CHECK(length(task_id)=36),
  request_id INTEGER NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('pending','claimed','playing','completed','failed','uncertain')),
  agent_id TEXT,
  lease_until INTEGER,
  command TEXT CHECK(command IS NULL OR command IN ('pause','resume','stop','skip')),
  command_seq INTEGER NOT NULL DEFAULT 0 CHECK(command_seq >= 0),
  playback_state TEXT NOT NULL DEFAULT 'idle' CHECK(playback_state IN ('idle','starting','playing','paused','stopped','unavailable')),
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  finished_at INTEGER,
  error_code TEXT,
  error_message TEXT
);
CREATE UNIQUE INDEX playback_task_request_once ON playback_task(request_id)
  WHERE state IN ('pending','claimed','playing','uncertain');
CREATE UNIQUE INDEX playback_task_one_active ON playback_task((1))
  WHERE state IN ('pending','claimed','playing','uncertain');
CREATE INDEX playback_task_history ON playback_task(created_at DESC, task_id);
CREATE INDEX playback_task_agent_lease ON playback_task(agent_id, lease_until)
  WHERE state IN ('claimed','playing');

CREATE TABLE playback_event (
  event_id INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id TEXT NOT NULL REFERENCES playback_task(task_id),
  event_key TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL CHECK(event_type IN ('claimed','playing','paused','resumed','skipped','stopped','failed','eof','uncertain','command')),
  agent_id TEXT,
  occurred_at INTEGER NOT NULL,
  details_json TEXT NOT NULL DEFAULT '{}'
);
CREATE INDEX playback_event_task_time ON playback_event(task_id, occurred_at, event_id);
