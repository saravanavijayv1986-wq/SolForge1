-- Add index for is_active on fair_mint_events for faster active event lookups
CREATE INDEX idx_fair_mint_events_is_active ON fair_mint_events(is_active);
