-- Add fee tracking table
CREATE TABLE token_creation_fees (
  id BIGSERIAL PRIMARY KEY,
  transaction_signature TEXT NOT NULL UNIQUE,
  creator_wallet TEXT NOT NULL,
  amount_sol TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add fee reference to tokens table
ALTER TABLE tokens ADD COLUMN fee_transaction_signature TEXT;

-- Create indexes for fee tracking
CREATE INDEX idx_token_creation_fees_signature ON token_creation_fees(transaction_signature);
CREATE INDEX idx_token_creation_fees_creator ON token_creation_fees(creator_wallet);
CREATE INDEX idx_token_creation_fees_created_at ON token_creation_fees(created_at DESC);
CREATE INDEX idx_tokens_fee_signature ON tokens(fee_transaction_signature);
