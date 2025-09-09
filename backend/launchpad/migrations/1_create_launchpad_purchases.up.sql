CREATE TABLE IF NOT EXISTS launchpad_purchases (
  id SERIAL PRIMARY KEY,
  wallet TEXT NOT NULL,
  sol_sent NUMERIC(38,18) NOT NULL,
  solf_paid NUMERIC(38,18) NOT NULL,
  fee_paid NUMERIC(38,18) NOT NULL,
  tx_sig TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lp_wallet ON launchpad_purchases(wallet);
CREATE INDEX IF NOT EXISTS idx_lp_tx_sig ON launchpad_purchases(tx_sig);
CREATE INDEX IF NOT EXISTS idx_lp_created_at ON launchpad_purchases(created_at DESC);
