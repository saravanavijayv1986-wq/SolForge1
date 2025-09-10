-- Add metadata fields to tokens table
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS metadata_url TEXT;

-- Create indexes for the new fields
CREATE INDEX IF NOT EXISTS idx_tokens_logo_url ON tokens(logo_url);
CREATE INDEX IF NOT EXISTS idx_tokens_metadata_url ON tokens(metadata_url);
