-- Fair mint events table
CREATE TABLE fair_mint_events (
  id BIGSERIAL PRIMARY KEY,
  event_name TEXT NOT NULL,
  description TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  is_finalized BOOLEAN NOT NULL DEFAULT false,
  total_usd_burned NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total_solf_allocated NUMERIC(20, 6) NOT NULL DEFAULT 0,
  solf_per_usd_rate NUMERIC(20, 10),
  tge_percentage INTEGER NOT NULL DEFAULT 20,
  vesting_days INTEGER NOT NULL DEFAULT 30,
  platform_fee_bps INTEGER NOT NULL DEFAULT 150,
  max_per_wallet_usd NUMERIC(20, 6) NOT NULL DEFAULT 5000,
  max_per_tx_usd NUMERIC(20, 6) NOT NULL DEFAULT 2500,
  quote_ttl_seconds INTEGER NOT NULL DEFAULT 90,
  min_tx_usd NUMERIC(20, 6) NOT NULL DEFAULT 20,
  treasury_address TEXT NOT NULL,
  referral_pool_percentage INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Accepted SPL tokens for fair mint
CREATE TABLE fair_mint_accepted_tokens (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  mint_address TEXT NOT NULL,
  token_name TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  token_logo_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  daily_cap_usd NUMERIC(20, 6) NOT NULL DEFAULT 250000,
  current_daily_burned_usd NUMERIC(20, 6) NOT NULL DEFAULT 0,
  last_daily_reset TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  dex_price_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, mint_address)
);

-- User burn transactions
CREATE TABLE fair_mint_burns (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  token_mint_address TEXT NOT NULL,
  token_amount NUMERIC(20, 6) NOT NULL,
  usd_value_at_burn NUMERIC(20, 6) NOT NULL,
  price_source TEXT NOT NULL,
  price_at_burn NUMERIC(20, 10) NOT NULL,
  estimated_solf NUMERIC(20, 6),
  actual_solf_allocated NUMERIC(20, 6),
  transaction_signature TEXT NOT NULL UNIQUE,
  referrer_wallet TEXT,
  quote_id TEXT NOT NULL,
  burn_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- User allocations and claims
CREATE TABLE fair_mint_allocations (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  total_usd_burned NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total_solf_allocated NUMERIC(20, 6) NOT NULL DEFAULT 0,
  tge_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,
  vesting_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,
  claimed_tge NUMERIC(20, 6) NOT NULL DEFAULT 0,
  claimed_vesting NUMERIC(20, 6) NOT NULL DEFAULT 0,
  last_claim_timestamp TIMESTAMPTZ,
  vesting_start_timestamp TIMESTAMPTZ,
  referral_bonus NUMERIC(20, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_wallet)
);

-- Price quotes with TTL
CREATE TABLE fair_mint_quotes (
  id BIGSERIAL PRIMARY KEY,
  quote_id TEXT NOT NULL UNIQUE,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  token_mint_address TEXT NOT NULL,
  token_amount NUMERIC(20, 6) NOT NULL,
  usd_value NUMERIC(20, 6) NOT NULL,
  estimated_solf NUMERIC(20, 6) NOT NULL,
  price_source TEXT NOT NULL,
  price_at_quote NUMERIC(20, 10) NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Referral tracking
CREATE TABLE fair_mint_referrals (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  referrer_wallet TEXT NOT NULL,
  referral_code TEXT NOT NULL UNIQUE,
  clicks INTEGER NOT NULL DEFAULT 0,
  successful_burns INTEGER NOT NULL DEFAULT 0,
  total_usd_referred NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total_bonus_solf NUMERIC(20, 6) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Event pause/resume log
CREATE TABLE fair_mint_pause_log (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'pause' or 'resume'
  reason TEXT,
  admin_wallet TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better query performance
CREATE INDEX idx_fair_mint_burns_event_user ON fair_mint_burns(event_id, user_wallet);
CREATE INDEX idx_fair_mint_burns_timestamp ON fair_mint_burns(burn_timestamp DESC);
CREATE INDEX idx_fair_mint_burns_tx_signature ON fair_mint_burns(transaction_signature);
CREATE INDEX idx_fair_mint_allocations_event_user ON fair_mint_allocations(event_id, user_wallet);
CREATE INDEX idx_fair_mint_quotes_quote_id ON fair_mint_quotes(quote_id);
CREATE INDEX idx_fair_mint_quotes_expires_at ON fair_mint_quotes(expires_at);
CREATE INDEX idx_fair_mint_referrals_code ON fair_mint_referrals(referral_code);
CREATE INDEX idx_fair_mint_accepted_tokens_event ON fair_mint_accepted_tokens(event_id, is_active);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_fair_mint_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_fair_mint_events_updated_at BEFORE UPDATE ON fair_mint_events
    FOR EACH ROW EXECUTE FUNCTION update_fair_mint_updated_at_column();

CREATE TRIGGER update_fair_mint_allocations_updated_at BEFORE UPDATE ON fair_mint_allocations
    FOR EACH ROW EXECUTE FUNCTION update_fair_mint_updated_at_column();

CREATE TRIGGER update_fair_mint_referrals_updated_at BEFORE UPDATE ON fair_mint_referrals
    FOR EACH ROW EXECUTE FUNCTION update_fair_mint_updated_at_column();
