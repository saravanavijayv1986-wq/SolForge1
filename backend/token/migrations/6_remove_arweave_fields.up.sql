-- This migration cleans up fields from a previous version that used Arweave.
ALTER TABLE tokens DROP COLUMN IF EXISTS image_transaction_id;
ALTER TABLE tokens DROP COLUMN IF EXISTS metadata_transaction_id;
