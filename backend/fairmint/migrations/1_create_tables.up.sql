-- fair_mint_events: one active event at a time (MVP)
CREATE TABLE IF NOT EXISTS fair_mint_events (
  id                    SERIAL PRIMARY KEY,
  event_name            TEXT NOT NULL,
  description           TEXT,
  start_time            TIMESTAMPTZ NOT NULL,
  end_time              TIMESTAMPTZ NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,

  -- simple integers to avoid numeric serialization friction
  tge_percentage        INTEGER NOT NULL CHECK (tge_percentage BETWEEN 0 AND 100),
  vesting_days          INTEGER NOT NULL CHECK (vesting_days BETWEEN 1 AND 365),
  platform_fee_bps      INTEGER NOT NULL CHECK (platform_fee_bps BETWEEN 0 AND 1000),
  referral_pool_percentage INTEGER NOT NULL CHECK (referral_pool_percentage BETWEEN 0 AND 20),

  -- USD amounts need scale
  max_per_wallet_usd    NUMERIC(38,18) NOT NULL,
  max_per_tx_usd        NUMERIC(38,18) NOT NULL,
  min_tx_usd            NUMERIC(38,18) NOT NULL,

  quote_ttl_seconds     INTEGER NOT NULL DEFAULT 60,
  treasury_address      TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fme_active ON fair_mint_events(is_active);

-- accepted tokens (which SPL mints are eligible to burn for this event)
CREATE TABLE IF NOT EXISTS fair_mint_accepted_tokens (
  id                    SERIAL PRIMARY KEY,
  event_id              INTEGER NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  mint_address          TEXT NOT NULL,
  token_symbol          TEXT NOT NULL,
  token_name            TEXT NOT NULL,
  token_logo_url        TEXT,
  daily_cap_usd         NUMERIC(38,18) NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT true,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmat_event ON fair_mint_accepted_tokens(event_id);

-- burns: each verified burn proof
CREATE TABLE IF NOT EXISTS fair_mint_burns (
  id                    SERIAL PRIMARY KEY,
  event_id              INTEGER NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  wallet                TEXT NOT NULL,
  mint_address          TEXT NOT NULL,
  amount_raw            NUMERIC(38,18) NOT NULL,  -- token units (UI, not lamports)
  usd_value             NUMERIC(38,18) NOT NULL,
  tx_sig                TEXT NOT NULL UNIQUE,
  verified              BOOLEAN NOT NULL DEFAULT false,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_fmb_event ON fair_mint_burns(event_id);
CREATE INDEX IF NOT EXISTS idx_fmb_wallet ON fair_mint_burns(wallet);
