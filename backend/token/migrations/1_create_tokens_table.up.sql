CREATE TABLE IF NOT EXISTS tokens (
  id BIGSERIAL PRIMARY KEY,
  mint_address TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  symbol TEXT NOT NULL,
  decimals INTEGER NOT NULL CHECK (decimals >= 0 AND decimals <= 9),
  supply NUMERIC(38,18) NOT NULL,
  description TEXT,
  logo_url TEXT,
  metadata_url TEXT,
  creator_wallet TEXT NOT NULL,
  total_minted NUMERIC(38,18) DEFAULT '0',
  is_mintable BOOLEAN DEFAULT true,
  is_frozen BOOLEAN DEFAULT false,
  mint_authority TEXT,
  freeze_authority TEXT,
  fee_transaction_signature TEXT,
  image_transaction_id TEXT,
  metadata_transaction_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_tokens_creator_wallet ON tokens(creator_wallet);
CREATE INDEX IF NOT EXISTS idx_tokens_mint_address ON tokens(mint_address);
CREATE INDEX IF NOT EXISTS idx_tokens_created_at ON tokens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_symbol ON tokens(symbol);
CREATE INDEX IF NOT EXISTS idx_tokens_name ON tokens(name);
CREATE INDEX IF NOT EXISTS idx_tokens_fee_signature ON tokens(fee_transaction_signature);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_tokens_updated_at BEFORE UPDATE ON tokens
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
