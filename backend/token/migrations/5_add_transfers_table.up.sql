-- Add token transfers table
CREATE TABLE IF NOT EXISTS token_transfers (
  id BIGSERIAL PRIMARY KEY,
  token_id BIGINT NOT NULL REFERENCES tokens(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  from_address TEXT NOT NULL,
  to_address TEXT NOT NULL,
  amount NUMERIC(38,18) NOT NULL,
  transaction_signature TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for transfers
CREATE INDEX IF NOT EXISTS idx_token_transfers_token_id ON token_transfers(token_id);
CREATE INDEX IF NOT EXISTS idx_token_transfers_mint_address ON token_transfers(mint_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_from_address ON token_transfers(from_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_to_address ON token_transfers(to_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_signature ON token_transfers(transaction_signature);
CREATE INDEX IF NOT EXISTS idx_token_transfers_created_at ON token_transfers(created_at DESC);

-- Create compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_token_transfers_from_to ON token_transfers(from_address, to_address);
CREATE INDEX IF NOT EXISTS idx_token_transfers_wallet_lookup ON token_transfers(from_address, to_address, created_at DESC);
