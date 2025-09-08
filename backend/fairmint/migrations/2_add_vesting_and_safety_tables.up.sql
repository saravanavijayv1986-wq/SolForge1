-- SOLF token vesting schedules
CREATE TABLE fair_mint_vesting (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  total_solf_allocated NUMERIC(20, 6) NOT NULL DEFAULT 0,
  tge_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,
  vesting_amount NUMERIC(20, 6) NOT NULL DEFAULT 0,
  claimed_tge NUMERIC(20, 6) NOT NULL DEFAULT 0,
  claimed_vesting NUMERIC(20, 6) NOT NULL DEFAULT 0,
  vesting_start_time TIMESTAMPTZ NOT NULL,
  vesting_end_time TIMESTAMPTZ NOT NULL,
  last_claim_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, user_wallet)
);

-- SOLF token claims history
CREATE TABLE fair_mint_claims (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT NOT NULL REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  user_wallet TEXT NOT NULL,
  tge_claimed NUMERIC(20, 6) NOT NULL DEFAULT 0,
  vesting_claimed NUMERIC(20, 6) NOT NULL DEFAULT 0,
  total_claimed NUMERIC(20, 6) NOT NULL DEFAULT 0,
  transaction_signature TEXT NOT NULL UNIQUE,
  claim_type TEXT NOT NULL CHECK (claim_type IN ('tge', 'vesting', 'both')),
  claim_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Safety monitoring logs
CREATE TABLE fair_mint_safety_logs (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  check_type TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('safe', 'warning', 'unsafe')),
  message TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
  details JSONB,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Emergency actions audit log
CREATE TABLE fair_mint_emergency_actions (
  id BIGSERIAL PRIMARY KEY,
  event_id BIGINT REFERENCES fair_mint_events(id) ON DELETE CASCADE,
  action_type TEXT NOT NULL CHECK (action_type IN ('pause', 'resume', 'cap_adjust', 'token_disable')),
  admin_wallet TEXT NOT NULL,
  reason TEXT NOT NULL,
  parameters JSONB,
  executed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL DEFAULT true
);

-- Price monitoring for safety checks
CREATE TABLE fair_mint_price_history (
  id BIGSERIAL PRIMARY KEY,
  token_mint_address TEXT NOT NULL,
  price_usd NUMERIC(20, 10) NOT NULL,
  price_source TEXT NOT NULL,
  confidence_score INTEGER NOT NULL DEFAULT 0,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_fair_mint_vesting_user_event ON fair_mint_vesting(user_wallet, event_id);
CREATE INDEX idx_fair_mint_vesting_vesting_times ON fair_mint_vesting(vesting_start_time, vesting_end_time);
CREATE INDEX idx_fair_mint_claims_user_event ON fair_mint_claims(user_wallet, event_id);
CREATE INDEX idx_fair_mint_claims_time ON fair_mint_claims(claim_time DESC);
CREATE INDEX idx_fair_mint_safety_logs_event_time ON fair_mint_safety_logs(event_id, checked_at DESC);
CREATE INDEX idx_fair_mint_safety_logs_status ON fair_mint_safety_logs(status, severity);
CREATE INDEX idx_fair_mint_emergency_actions_event ON fair_mint_emergency_actions(event_id, executed_at DESC);
CREATE INDEX idx_fair_mint_price_history_mint_time ON fair_mint_price_history(token_mint_address, recorded_at DESC);

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_fair_mint_vesting_updated_at BEFORE UPDATE ON fair_mint_vesting
    FOR EACH ROW EXECUTE FUNCTION update_fair_mint_updated_at_column();

-- Add automatic price history recording trigger
CREATE OR REPLACE FUNCTION record_price_history()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO fair_mint_price_history (
        token_mint_address, price_usd, price_source, confidence_score
    ) VALUES (
        NEW.token_mint_address, 
        CAST(NEW.price_at_burn AS NUMERIC), 
        NEW.price_source,
        CASE 
            WHEN NEW.price_source LIKE '%RAYDIUM%' THEN 90
            WHEN NEW.price_source LIKE '%JUPITER%' THEN 85
            ELSE 70
        END
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_record_price_history 
    AFTER INSERT ON fair_mint_burns
    FOR EACH ROW EXECUTE FUNCTION record_price_history();

-- Add function to automatically reset daily caps
CREATE OR REPLACE FUNCTION auto_reset_daily_caps()
RETURNS void AS $$
BEGIN
    UPDATE fair_mint_accepted_tokens 
    SET current_daily_burned_usd = 0, 
        last_daily_reset = NOW()
    WHERE is_active = true 
      AND last_daily_reset < NOW() - INTERVAL '24 hours';
END;
$$ LANGUAGE plpgsql;
