-- Study P schema for MySQL 8.0+ (migrated from Cloudflare D1 / SQLite)
--
-- Flow: activity_requests (student/parent submits)
--       -> admin approves or rejects
--       -> approved request creates exactly one row in point_history
--
-- SQLite -> MySQL changes
--   TEXT timestamps (ISO strings)  -> DATETIME (KST, stored without timezone)
--   free-text type                 -> FK to activity_types
--   no constraints                 -> FK, UNIQUE, CHECK (enforced since MySQL 8.0.16)

CREATE DATABASE IF NOT EXISTS study_p
  DEFAULT CHARACTER SET utf8mb4
  DEFAULT COLLATE utf8mb4_unicode_ci;
USE study_p;

CREATE TABLE students (
  student_id    VARCHAR(64)  NOT NULL,              -- pseudonymous id, never a real name
  alias         VARCHAR(50)  NOT NULL,              -- display alias, e.g. 'S01'
  grade_level   TINYINT      NULL,                  -- school grade (1-12)
  is_test       TINYINT(1)   NOT NULL DEFAULT 0,    -- 1 = portfolio test scenario
  status        ENUM('active','paused','left') NOT NULL DEFAULT 'active',
  joined_at     DATE         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id),
  CONSTRAINT chk_students_grade CHECK (grade_level IS NULL OR grade_level BETWEEN 1 AND 12)
) ENGINE=InnoDB;

CREATE TABLE activity_types (
  type_code       VARCHAR(32)  NOT NULL,            -- 'attendance', 'homework', ...
  name_ko         VARCHAR(50)  NOT NULL,
  default_points  INT          NOT NULL,
  daily_limit     TINYINT      NULL,                -- max approvals per student per day (NULL = no limit)
  is_active       TINYINT(1)   NOT NULL DEFAULT 1,
  PRIMARY KEY (type_code),
  CONSTRAINT chk_types_points CHECK (default_points <> 0)
) ENGINE=InnoDB;

CREATE TABLE activity_requests (
  request_id     BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id     VARCHAR(64)  NOT NULL,
  type_code      VARCHAR(32)  NOT NULL,
  activity_date  DATE         NOT NULL,             -- day the activity happened
  requested_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  requested_by   ENUM('student','parent','admin') NOT NULL DEFAULT 'student',
  status         ENUM('pending','approved','rejected','cancelled') NOT NULL DEFAULT 'pending',
  reviewed_at    DATETIME     NULL,
  reviewer       VARCHAR(50)  NULL,
  reject_reason  VARCHAR(200) NULL,                 -- optional: rejecting without a reason is allowed
  note           VARCHAR(500) NULL,
  PRIMARY KEY (request_id),
  KEY idx_req_student_date (student_id, activity_date),
  KEY idx_req_status (status, requested_at),
  CONSTRAINT fk_req_student FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_req_type    FOREIGN KEY (type_code)  REFERENCES activity_types (type_code),
  -- a reviewed request must have a review time; a pending one must not
  CONSTRAINT chk_req_review CHECK (
    (status = 'pending' AND reviewed_at IS NULL) OR
    (status <> 'pending' AND reviewed_at IS NOT NULL)
  )
) ENGINE=InnoDB;

CREATE TABLE point_history (
  history_id   BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id   VARCHAR(64)  NOT NULL,
  request_id   BIGINT UNSIGNED NULL,               -- NULL for manual adjustments / reward redemption
  type_code    VARCHAR(32)  NOT NULL,
  points       INT          NOT NULL,              -- negative = points spent on a reward
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  memo         VARCHAR(200) NULL,
  PRIMARY KEY (history_id),
  UNIQUE KEY uq_history_request (request_id),      -- one approval -> at most one history row
  KEY idx_hist_student_time (student_id, created_at),
  KEY idx_hist_type_time (type_code, created_at),
  CONSTRAINT fk_hist_student FOREIGN KEY (student_id) REFERENCES students (student_id),
  CONSTRAINT fk_hist_request FOREIGN KEY (request_id) REFERENCES activity_requests (request_id),
  CONSTRAINT fk_hist_type    FOREIGN KEY (type_code)  REFERENCES activity_types (type_code),
  CONSTRAINT chk_hist_points CHECK (points <> 0)
) ENGINE=InnoDB;
