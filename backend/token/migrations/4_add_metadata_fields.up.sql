-- Add metadata fields to tokens table
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS metadata_url TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS image_transaction_id TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS metadata_transaction_id TEXT;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_tokens_logo_url ON tokens(logo_url);
CREATE INDEX IF NOT EXISTS idx_tokens_metadata_url ON tokens(metadata_url);
CREATE INDEX IF NOT EXISTS idx_tokens_image_transaction_id ON tokens(image_transaction_id);
CREATE INDEX IF NOT EXISTS idx_tokens_metadata_transaction_id ON tokens(metadata_transaction_id);
