CREATE TABLE cv_request_events_next (
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
      'requester_notification_failed',
      'cv_delivery_link_created',
      'cv_delivery_link_unavailable',
      'cv_download_succeeded',
      'cv_download_failed'
    )
  ),
  createdAt TEXT NOT NULL,
  metadataJson TEXT CHECK (metadataJson IS NULL OR json_valid(metadataJson))
);

INSERT INTO cv_request_events_next (
  id,
  requestId,
  eventType,
  createdAt,
  metadataJson
)
SELECT
  id,
  requestId,
  eventType,
  createdAt,
  metadataJson
FROM cv_request_events;

DROP TABLE cv_request_events;

ALTER TABLE cv_request_events_next RENAME TO cv_request_events;

CREATE INDEX idx_cv_request_events_requestId_createdAt
  ON cv_request_events (requestId, createdAt);

CREATE INDEX idx_cv_request_events_eventType_createdAt
  ON cv_request_events (eventType, createdAt);
