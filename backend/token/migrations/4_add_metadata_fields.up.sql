-- Add metadata fields to tokens table
ALTER TABLE tokens ADD COLUMN image_url TEXT;
ALTER TABLE tokens ADD COLUMN metadata_url TEXT;
ALTER TABLE tokens ADD COLUMN image_transaction_id TEXT;
ALTER TABLE tokens ADD COLUMN metadata_transaction_id TEXT;

-- Create indexes for the new fields
CREATE INDEX idx_tokens_image_transaction_id ON tokens(image_transaction_id);
CREATE INDEX idx_tokens_metadata_transaction_id ON tokens(metadata_transaction_id);
