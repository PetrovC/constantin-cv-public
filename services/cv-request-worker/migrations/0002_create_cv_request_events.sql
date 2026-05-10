CREATE TABLE IF NOT EXISTS cv_request_events (
  id TEXT PRIMARY KEY NOT NULL,
  requestId TEXT NOT NULL,
  eventType TEXT NOT NULL CHECK (
    eventType IN (
      'request_created',
      'owner_notification_sent',
      'owner_notification_failed',
      'request_approved',
      'request_rejected',
      'requester_notification_sent',
      'requester_notification_failed'
    )
  ),
  createdAt TEXT NOT NULL,
  metadataJson TEXT CHECK (metadataJson IS NULL OR json_valid(metadataJson))
);

CREATE INDEX IF NOT EXISTS idx_cv_request_events_requestId_createdAt
  ON cv_request_events (requestId, createdAt);

CREATE INDEX IF NOT EXISTS idx_cv_request_events_eventType_createdAt
  ON cv_request_events (eventType, createdAt);
