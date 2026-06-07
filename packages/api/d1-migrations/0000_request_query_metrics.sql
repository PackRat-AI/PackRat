-- D1 schema for per-request query metrics.
-- capturedAt is stored as INTEGER (Unix milliseconds) — SQLite has no native timestamptz.
-- queries is stored as TEXT (JSON array of CapturedQuery objects).

CREATE TABLE IF NOT EXISTS request_query_metrics (
  id                     TEXT    PRIMARY KEY,
  captured_at            INTEGER NOT NULL,
  route                  TEXT    NOT NULL,
  method                 TEXT    NOT NULL,
  status_code            INTEGER,
  total_duration_ms      INTEGER NOT NULL DEFAULT 0,
  estimated_egress_bytes INTEGER NOT NULL DEFAULT 0,
  query_count            INTEGER NOT NULL DEFAULT 0,
  user_id                TEXT,
  queries                TEXT    NOT NULL DEFAULT '[]'
);

CREATE INDEX IF NOT EXISTS rqm_captured_at_route_idx ON request_query_metrics (captured_at, route);
CREATE INDEX IF NOT EXISTS rqm_captured_at_idx       ON request_query_metrics (captured_at);
