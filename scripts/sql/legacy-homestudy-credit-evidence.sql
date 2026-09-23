-- DEV credit evidence for Knit It Now Home Study purchases.
-- Not part of the legacy_* snapshot truncate.
-- Empty until a classified credt_history extract is loaded.
-- Do not run this against production from this change.

CREATE TABLE IF NOT EXISTS legacy_homestudy_credit_evidence (
  credit_id INTEGER PRIMARY KEY,
  transaction_type TEXT NOT NULL,
  dollar_amount NUMERIC(12, 4),
  authorize_id TEXT,
  transaction_guid TEXT
);
