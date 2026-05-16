CREATE TABLE IF NOT EXISTS cv_request_rate_limits (
  clientKey TEXT PRIMARY KEY NOT NULL,
  windowStartedAt TEXT NOT NULL,
  requestCount INTEGER NOT NULL CHECK (requestCount >= 0)
);

CREATE INDEX IF NOT EXISTS idx_cv_request_rate_limits_windowStartedAt
  ON cv_request_rate_limits (windowStartedAt);
