-- Study P analysis database for MySQL 8.0+
--
-- Mirrors the tables the live app writes to Cloudflare D1 (web/db/schema.ts,
-- web/drizzle/*.sql) so D1 exports can be loaded as-is.
--   * D1 = operational DB (the app). MySQL = analysis DB (extraction, validation, reports).
--   * Left out on purpose: sessions, settings, photo_evidence, users.username/password_hash.
--     Credentials and photos never leave the app.
--
-- SQLite -> MySQL changes
--   TEXT ISO-8601 timestamps -> DATETIME (UTC, as the app stores them)
--   free TEXT status values  -> ENUM with the values the app actually writes
--   rules enforced only in app code -> CHECK constraints (MySQL 8.0.16+)

CREATE DATABASE IF NOT EXISTS study_p
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE study_p;

-- students and admins
CREATE TABLE users (
  id          VARCHAR(64)  NOT NULL,
  name        VARCHAR(40)  NOT NULL,                       -- replaced with an alias on export
  grade       VARCHAR(4)   NOT NULL DEFAULT '',            -- '초1'..'중3', '' for admin
  role        ENUM('student','admin') NOT NULL DEFAULT 'student',
  status      ENUM('pending','active','rejected') NOT NULL DEFAULT 'pending',
  created_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  KEY idx_users_role_status (role, status)
) ENGINE=InnoDB;

-- reference table for report labels (not a foreign key: the app stores type as free text,
-- so unknown types are caught by a validation query instead of being rejected on load)
CREATE TABLE activity_types (
  type_code   VARCHAR(32)  NOT NULL,
  name_ko     VARCHAR(50)  NOT NULL,
  is_request  TINYINT(1)   NOT NULL,                      -- 1 = students can request it
  PRIMARY KEY (type_code)
) ENGINE=InnoDB;

-- activity requests submitted by students
CREATE TABLE point_requests (
  id            VARCHAR(64)  NOT NULL,
  student_id    VARCHAR(64)  NOT NULL,
  type          VARCHAR(32)  NOT NULL,
  points        INT          NOT NULL,
  details       VARCHAR(500) NOT NULL DEFAULT '',
  has_photo     TINYINT(1)   NOT NULL DEFAULT 0,          -- photo_key IS NOT NULL in D1
  status        ENUM('pending','held','approved','rejected') NOT NULL DEFAULT 'pending',
  reason        VARCHAR(300) NULL,                         -- optional for rejection, required for hold
  requested_at  DATETIME     NOT NULL,
  reviewed_at   DATETIME     NULL,
  reviewed_by   VARCHAR(64)  NULL,
  PRIMARY KEY (id),
  KEY idx_requests_student_time (student_id, requested_at),
  KEY idx_requests_status (status),
  CONSTRAINT fk_requests_student  FOREIGN KEY (student_id)  REFERENCES users (id),
  CONSTRAINT fk_requests_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id),
  CONSTRAINT chk_requests_review CHECK (
    (status = 'pending' AND reviewed_at IS NULL) OR
    (status <> 'pending' AND reviewed_at IS NOT NULL)
  ),
  CONSTRAINT chk_requests_hold_reason CHECK (status <> 'held' OR reason IS NOT NULL),
  CONSTRAINT chk_requests_time CHECK (reviewed_at IS NULL OR reviewed_at >= requested_at)
) ENGINE=InnoDB;

-- point ledger: one row per approval, manual adjustment or reward payment
CREATE TABLE point_history (
  id          VARCHAR(64)  NOT NULL,
  student_id  VARCHAR(64)  NOT NULL,
  points      INT          NOT NULL,                       -- negative = spent / deducted
  type        VARCHAR(32)  NOT NULL,
  reason      VARCHAR(300) NOT NULL,
  request_id  VARCHAR(64)  NULL,                           -- NULL for adjust / reward
  actor_id    VARCHAR(64)  NOT NULL,
  created_at  DATETIME     NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_history_request (request_id),              -- one request -> at most one ledger row
  KEY idx_history_student_time (student_id, created_at),
  KEY idx_history_type_time (type, created_at),
  CONSTRAINT fk_history_student FOREIGN KEY (student_id) REFERENCES users (id),
  CONSTRAINT fk_history_actor   FOREIGN KEY (actor_id)   REFERENCES users (id),
  CONSTRAINT fk_history_request FOREIGN KEY (request_id) REFERENCES point_requests (id),
  CONSTRAINT chk_history_points CHECK (points <> 0)
) ENGINE=InnoDB;

-- reward (card) exchange requests
CREATE TABLE reward_requests (
  id               VARCHAR(64) NOT NULL,
  student_id       VARCHAR(64) NOT NULL,
  amount           INT         NOT NULL,
  cost             INT         NOT NULL,
  status           ENUM('pending','held','approved','rejected') NOT NULL DEFAULT 'pending',
  delivery_status  ENUM('not_started','waiting','complete') NOT NULL DEFAULT 'not_started',
  reason           VARCHAR(300) NULL,
  requested_at     DATETIME    NOT NULL,
  reviewed_at      DATETIME    NULL,
  reviewed_by      VARCHAR(64) NULL,
  PRIMARY KEY (id),
  KEY idx_rewards_student_time (student_id, requested_at),
  CONSTRAINT fk_rewards_student  FOREIGN KEY (student_id)  REFERENCES users (id),
  CONSTRAINT fk_rewards_reviewer FOREIGN KEY (reviewed_by) REFERENCES users (id),
  CONSTRAINT chk_rewards_amount CHECK (amount > 0 AND cost > 0),
  CONSTRAINT chk_rewards_delivery CHECK (delivery_status = 'not_started' OR status = 'approved')
) ENGINE=InnoDB;

-- once-a-day attendance guard
CREATE TABLE attendance (
  id          VARCHAR(64) NOT NULL,
  student_id  VARCHAR(64) NOT NULL,
  day         DATE        NOT NULL,
  request_id  VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_attendance_student_day (student_id, day),
  CONSTRAINT fk_attendance_student FOREIGN KEY (student_id) REFERENCES users (id),
  CONSTRAINT fk_attendance_request FOREIGN KEY (request_id) REFERENCES point_requests (id)
) ENGINE=InnoDB;
