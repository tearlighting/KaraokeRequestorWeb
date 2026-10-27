CREATE TABLE IF NOT EXISTS app_user (
  userid CHAR(36) PRIMARY KEY,
  displayname VARCHAR(256) NOT NULL DEFAULT '',
  icon_path VARCHAR(1024) NULL,
  created_at BIGINT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reservation (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  songfile VARCHAR(1024) NOT NULL,
  singer VARCHAR(512) NOT NULL DEFAULT '',
  comment TEXT NOT NULL,
  kind VARCHAR(128) NOT NULL,
  reqorder BIGINT NOT NULL DEFAULT 0,
  fullpath VARCHAR(4096) NOT NULL DEFAULT '',
  nowplaying VARCHAR(64) NOT NULL DEFAULT '未再生',
  status VARCHAR(64) NOT NULL DEFAULT 'new',
  clientip VARCHAR(256) NOT NULL DEFAULT '',
  clientua VARCHAR(1024) NOT NULL DEFAULT '',
  playtimes BIGINT NOT NULL DEFAULT 0,
  secret BIGINT NOT NULL DEFAULT 0,
  `loop` BIGINT NOT NULL DEFAULT 0,
  keychange BIGINT NOT NULL DEFAULT 0,
  track BIGINT NOT NULL DEFAULT 0,
  pause BIGINT NOT NULL DEFAULT 0,
  audiodelay BIGINT NOT NULL DEFAULT 0,
  duration BIGINT NOT NULL DEFAULT 0,
  volume BIGINT NOT NULL DEFAULT 0,
  song_name VARCHAR(1024) NOT NULL DEFAULT '',
  lister_artist VARCHAR(1024) NOT NULL DEFAULT '',
  lister_work VARCHAR(1024) NOT NULL DEFAULT '',
  lister_op_ed VARCHAR(1024) NOT NULL DEFAULT '',
  lister_comment TEXT NOT NULL,
  created_at BIGINT NOT NULL,
  KEY reservation_order (reqorder DESC, id DESC),
  KEY reservation_status_order (nowplaying, reqorder, id),
  KEY reservation_owner (clientip, clientua(191), reqorder)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS request_submission (
  key_hash CHAR(64) PRIMARY KEY,
  input_hash CHAR(64) NOT NULL,
  owner_id CHAR(36) NOT NULL,
  request_id BIGINT UNSIGNED NOT NULL,
  operation VARCHAR(16) NOT NULL,
  committed_at BIGINT NOT NULL,
  result_json JSON NOT NULL,
  KEY submission_owner (owner_id, committed_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;


CREATE TABLE IF NOT EXISTS request_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userid CHAR(36) NOT NULL,
  fullpath VARCHAR(4096) NOT NULL,
  songfile VARCHAR(1024) NOT NULL,
  kind VARCHAR(128) NOT NULL,
  requested_at BIGINT NOT NULL,
  CONSTRAINT history_user_fk FOREIGN KEY (userid) REFERENCES app_user(userid) ON DELETE CASCADE,
  KEY history_user_time (userid, requested_at DESC, id DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS saved_song (
  userid CHAR(36) NOT NULL,
  fullpath VARCHAR(4096) NOT NULL,
  fullpath_hash CHAR(64) NOT NULL,
  songfile VARCHAR(1024) NOT NULL,
  kind VARCHAR(128) NOT NULL,
  saved_kind ENUM('later','favorite') NOT NULL,
  added_at BIGINT NOT NULL,
  PRIMARY KEY (userid, fullpath_hash, saved_kind),
  CONSTRAINT saved_song_user_fk FOREIGN KEY (userid) REFERENCES app_user(userid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS favorite_keyword (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  userid CHAR(36) NOT NULL,
  keyword VARCHAR(512) NOT NULL,
  search_type VARCHAR(64) NOT NULL,
  search_params JSON NOT NULL,
  added_at BIGINT NOT NULL,
  CONSTRAINT favorite_keyword_user_fk FOREIGN KEY (userid) REFERENCES app_user(userid) ON DELETE CASCADE,
  KEY favorite_keyword_user (userid, added_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS pair_code (
  code VARCHAR(64) PRIMARY KEY,
  userid CHAR(36) NOT NULL,
  expires_at BIGINT NOT NULL,
  CONSTRAINT pair_code_user_fk FOREIGN KEY (userid) REFERENCES app_user(userid) ON DELETE CASCADE,
  KEY pair_code_expiry (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS external_identity (
  userid CHAR(36) PRIMARY KEY,
  provider VARCHAR(32) NOT NULL,
  provider_sub VARCHAR(256) NOT NULL,
  provider_email VARCHAR(512) NOT NULL DEFAULT '',
  token_ciphertext MEDIUMBLOB NULL,
  token_expires_at BIGINT NULL,
  last_synced_at BIGINT NULL,
  linked_at BIGINT NOT NULL,
  auto_sync TINYINT NOT NULL DEFAULT 0,
  UNIQUE KEY external_subject (provider, provider_sub),
  CONSTRAINT external_identity_user_fk FOREIGN KEY (userid) REFERENCES app_user(userid) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS app_setting (
  setting_key VARCHAR(128) PRIMARY KEY,
  value_json JSON NOT NULL,
  updated_at BIGINT NOT NULL,
  revision BIGINT NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS playback_task (
  task_id CHAR(36) PRIMARY KEY,
  request_id BIGINT UNSIGNED NOT NULL,
  state ENUM('pending','claimed','playing','completed','failed','uncertain') NOT NULL,
  active_request_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN state IN ('pending','claimed','playing','uncertain') THEN request_id ELSE NULL END) STORED,
  active_slot TINYINT GENERATED ALWAYS AS (CASE WHEN state IN ('pending','claimed','playing','uncertain') THEN 1 ELSE NULL END) STORED,
  agent_id VARCHAR(64) NULL,
  lease_until BIGINT NULL,
  command ENUM('pause','resume','stop','skip') NULL,
  command_seq BIGINT NOT NULL DEFAULT 0,
  playback_state ENUM('idle','starting','playing','paused','stopped','unavailable') NOT NULL DEFAULT 'idle',
  created_at BIGINT NOT NULL,
  updated_at BIGINT NOT NULL,
  started_at BIGINT NULL,
  finished_at BIGINT NULL,
  error_code VARCHAR(64) NULL,
  error_message VARCHAR(512) NULL,
  UNIQUE KEY playback_active_request (active_request_id),
  UNIQUE KEY playback_active_slot (active_slot),
  KEY playback_history (created_at DESC, task_id),
  KEY playback_agent_lease (agent_id, lease_until, state)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS playback_event (
  event_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  task_id CHAR(36) NOT NULL,
  event_key VARCHAR(128) NOT NULL,
  event_type ENUM('claimed','playing','paused','resumed','skipped','stopped','failed','eof','uncertain','command') NOT NULL,
  agent_id VARCHAR(64) NULL,
  occurred_at BIGINT NOT NULL,
  details_json JSON NOT NULL,
  UNIQUE KEY playback_event_key (event_key),
  CONSTRAINT playback_event_task_fk FOREIGN KEY (task_id) REFERENCES playback_task(task_id) ON DELETE CASCADE,
  KEY playback_event_task_time (task_id, occurred_at, event_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
