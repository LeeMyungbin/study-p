CREATE TABLE IF NOT EXISTS photo_evidence (
  key TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL,
  mime TEXT NOT NULL,
  data TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_photo_evidence_created ON photo_evidence(created_at);
