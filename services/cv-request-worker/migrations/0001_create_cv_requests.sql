CREATE TABLE IF NOT EXISTS cv_requests (
  id TEXT PRIMARY KEY NOT NULL,
  fullName TEXT NOT NULL CHECK (length(fullName) BETWEEN 1 AND 120),
  requesterEmail TEXT NOT NULL CHECK (length(requesterEmail) BETWEEN 1 AND 254),
  company TEXT NOT NULL CHECK (length(company) BETWEEN 1 AND 160),
  profileUrl TEXT CHECK (profileUrl IS NULL OR length(profileUrl) BETWEEN 1 AND 2048),
  requestedCvType TEXT NOT NULL CHECK (requestedCvType IN ('one-page', 'full-dev')),
  requestedLanguage TEXT NOT NULL CHECK (requestedLanguage IN ('fr', 'en', 'de')),
  reason TEXT NOT NULL CHECK (length(reason) BETWEEN 1 AND 2000),
  status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'delivered', 'expired')),
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_cv_requests_status_createdAt
  ON cv_requests (status, createdAt);
