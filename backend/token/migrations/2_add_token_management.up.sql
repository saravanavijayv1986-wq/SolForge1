-- Add minting tracking table
CREATE TABLE IF NOT EXISTS token_mints (
  id BIGSERIAL PRIMARY KEY,
  token_id BIGINT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  amount NUMERIC(38,18) NOT NULL,
  minted_by TEXT NOT NULL,
  transaction_signature TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add token balances table
CREATE TABLE IF NOT EXISTS token_balances (
  id BIGSERIAL PRIMARY KEY,
  token_id BIGINT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  balance NUMERIC(38,18) NOT NULL DEFAULT '0',
  last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(token_id, wallet_address)
);

-- Add additional token management fields
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS total_minted NUMERIC(38,18) DEFAULT '0';
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS is_mintable BOOLEAN DEFAULT true;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS mint_authority TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS freeze_authority TEXT;
ALTER TABLE tokens ADD COLUMN IF NOT EXISTS is_frozen BOOLEAN DEFAULT false;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_token_mints_token_id ON token_mints(token_id);
CREATE INDEX IF NOT EXISTS idx_token_mints_mint_address ON token_mints(mint_address);
CREATE INDEX IF NOT EXISTS idx_token_mints_recipient ON token_mints(recipient_address);
CREATE INDEX IF NOT EXISTS idx_token_mints_created_at ON token_mints(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_token_balances_token_id ON token_balances(token_id);
CREATE INDEX IF NOT EXISTS idx_token_balances_mint_address ON token_balances(mint_address);
CREATE INDEX IF NOT EXISTS idx_token_balances_wallet ON token_balances(wallet_address);

-- Add trigger to update token balances last_updated timestamp
CREATE OR REPLACE FUNCTION update_balance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_token_balances_timestamp BEFORE UPDATE ON token_balances
    FOR EACH ROW EXECUTE FUNCTION update_balance_timestamp();
