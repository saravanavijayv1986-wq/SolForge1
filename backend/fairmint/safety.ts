import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";
import { secret } from "encore.dev/config";

const adminWalletAddress = secret("AdminWalletAddress");

export interface SafetyCheck {
  checkType: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface SafetyReport {
  overallStatus: 'safe' | 'warning' | 'unsafe';
  checks: SafetyCheck[];
  timestamp: Date;
}

export interface EmergencyAction {
  action: 'pause' | 'resume' | 'cap_adjust' | 'token_disable';
  reason: string;
  adminWallet: string;
  parameters?: {
    eventId?: number;
    tokenMint?: string;
    newCap?: string;
  };
}

// Comprehensive safety monitoring for fair mint events
export const performSafetyCheck = api<{ eventId?: number }, SafetyReport>(
  { expose: true, method: "GET", path: "/fair-mint/safety/check" },
  async (req) => {
    const checks: SafetyCheck[] = [];
    
    // Get active event if none specified
    let eventId = req.eventId;
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        return {
          overallStatus: 'safe',
          checks: [{
            checkType: 'event_status',
            passed: true,
            message: 'No active fair mint event',
            severity: 'info'
          }],
          timestamp: new Date()
        };
      }
      eventId = activeEvent.id;
    }

    // Check 1: Event timing and status
    const event = await fairMintDB.queryRow<{
      id: number;
      eventName: string;
      startTime: Date;
      endTime: Date;
      isActive: boolean;
      totalUsdBurned: string;
      maxPerWalletUsd: string;
      maxPerTxUsd: string;
    }>`
      SELECT id, event_name as "eventName", start_time as "startTime", 
             end_time as "endTime", is_active as "isActive",
             total_usd_burned as "totalUsdBurned", max_per_wallet_usd as "maxPerWalletUsd",
             max_per_tx_usd as "maxPerTxUsd"
      FROM fair_mint_events WHERE id = ${eventId}
    `;

    if (!event) {
      throw APIError.notFound("Event not found");
    }

    const now = new Date();
    
    // Timing checks
    if (event.isActive && now > event.endTime) {
      checks.push({
        checkType: 'event_timing',
        passed: false,
        message: 'Event has passed end time but is still active',
        severity: 'error'
      });
    } else if (event.isActive && now < event.startTime) {
      checks.push({
        checkType: 'event_timing',
        passed: false,
        message: 'Event is active but start time is in the future',
        severity: 'warning'
      });
    } else {
      checks.push({
        checkType: 'event_timing',
        passed: true,
        message: 'Event timing is correct',
        severity: 'info'
      });
    }

    // Check 2: Daily caps and burn volumes
    const tokenCapChecks = await fairMintDB.queryAll<{
      tokenSymbol: string;
      dailyCapUsd: string;
      currentDailyBurnedUsd: string;
      lastDailyReset: Date;
    }>`
      SELECT token_symbol as "tokenSymbol", daily_cap_usd as "dailyCapUsd",
             current_daily_burned_usd as "currentDailyBurnedUsd",
             last_daily_reset as "lastDailyReset"
      FROM fair_mint_accepted_tokens 
      WHERE event_id = ${eventId} AND is_active = true
    `;

    for (const token of tokenCapChecks) {
      const capUtilization = (parseFloat(token.currentDailyBurnedUsd) / parseFloat(token.dailyCapUsd)) * 100;
      
      if (capUtilization >= 100) {
        checks.push({
          checkType: 'daily_cap',
          passed: false,
          message: `${token.tokenSymbol} has reached 100% of daily cap`,
          severity: 'error'
        });
      } else if (capUtilization >= 90) {
        checks.push({
          checkType: 'daily_cap',
          passed: false,
          message: `${token.tokenSymbol} is at ${capUtilization.toFixed(1)}% of daily cap`,
          severity: 'warning'
        });
      }

      // Check if daily reset is overdue (should reset every 24 hours)
      const hoursSinceReset = (now.getTime() - token.lastDailyReset.getTime()) / (1000 * 60 * 60);
      if (hoursSinceReset > 25) { // 1 hour grace period
        checks.push({
          checkType: 'daily_reset',
          passed: false,
          message: `${token.tokenSymbol} daily cap hasn't been reset in ${hoursSinceReset.toFixed(1)} hours`,
          severity: 'warning'
        });
      }
    }

    // Check 3: Burn velocity and patterns
    const recentBurns = await fairMintDB.queryAll<{
      burnTimestamp: Date;
      usdValueAtBurn: string;
      userWallet: string;
    }>`
      SELECT burn_timestamp as "burnTimestamp", usd_value_at_burn as "usdValueAtBurn",
             user_wallet as "userWallet"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId} AND burn_timestamp >= NOW() - INTERVAL '1 hour'
      ORDER BY burn_timestamp DESC
    `;

    const recentBurnValue = recentBurns.reduce((sum, burn) => sum + parseFloat(burn.usdValueAtBurn), 0);
    const hourlyBurnRate = recentBurnValue;

    if (hourlyBurnRate > 100000) { // $100k per hour threshold
      checks.push({
        checkType: 'burn_velocity',
        passed: false,
        message: `High burn velocity: $${hourlyBurnRate.toLocaleString()} in last hour`,
        severity: 'warning'
      });
    }

    // Check for suspicious patterns (same wallet, rapid succession)
    const walletBurnCounts = new Map<string, number>();
    recentBurns.forEach(burn => {
      walletBurnCounts.set(burn.userWallet, (walletBurnCounts.get(burn.userWallet) || 0) + 1);
    });

    for (const [wallet, count] of walletBurnCounts) {
      if (count >= 10) {
        checks.push({
          checkType: 'suspicious_activity',
          passed: false,
          message: `Wallet ${wallet.slice(0, 8)}... has ${count} burns in the last hour`,
          severity: 'warning'
        });
      }
    }

    // Check 4: Quote expiry compliance
    const expiredQuotesUsed = await fairMintDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM fair_mint_burns b
      JOIN fair_mint_quotes q ON b.quote_id = q.quote_id
      WHERE b.event_id = ${eventId} 
        AND b.burn_timestamp > q.expires_at
        AND b.burn_timestamp >= NOW() - INTERVAL '1 hour'
    `;

    if (expiredQuotesUsed && expiredQuotesUsed.count > 0) {
      checks.push({
        checkType: 'quote_compliance',
        passed: false,
        message: `${expiredQuotesUsed.count} expired quotes were used in the last hour`,
        severity: 'error'
      });
    }

    // Check 5: Price deviation monitoring
    const priceDeviations = await fairMintDB.queryAll<{
      tokenSymbol: string;
      avgPrice: string;
      minPrice: string;
      maxPrice: string;
      priceVariance: string;
    }>`
      SELECT 
        t.token_symbol as "tokenSymbol",
        AVG(CAST(b.price_at_burn AS NUMERIC)) as "avgPrice",
        MIN(CAST(b.price_at_burn AS NUMERIC)) as "minPrice",
        MAX(CAST(b.price_at_burn AS NUMERIC)) as "maxPrice",
        STDDEV(CAST(b.price_at_burn AS NUMERIC)) as "priceVariance"
      FROM fair_mint_burns b
      JOIN fair_mint_accepted_tokens t ON b.token_mint_address = t.mint_address
      WHERE b.event_id = ${eventId} 
        AND b.burn_timestamp >= NOW() - INTERVAL '1 hour'
        AND t.event_id = ${eventId}
      GROUP BY t.token_symbol
      HAVING COUNT(*) >= 5
    `;

    for (const priceCheck of priceDeviations) {
      const avgPrice = parseFloat(priceCheck.avgPrice);
      const minPrice = parseFloat(priceCheck.minPrice);
      const maxPrice = parseFloat(priceCheck.maxPrice);
      
      if (avgPrice > 0) {
        const priceSwing = ((maxPrice - minPrice) / avgPrice) * 100;
        
        if (priceSwing > 20) { // 20% price swing threshold
          checks.push({
            checkType: 'price_stability',
            passed: false,
            message: `${priceCheck.tokenSymbol} has ${priceSwing.toFixed(1)}% price swing in last hour`,
            severity: 'warning'
          });
        }
      }
    }

    // Determine overall status
    const hasErrors = checks.some(check => check.severity === 'error' && !check.passed);
    const hasWarnings = checks.some(check => check.severity === 'warning' && !check.passed);
    
    let overallStatus: 'safe' | 'warning' | 'unsafe';
    if (hasErrors) {
      overallStatus = 'unsafe';
    } else if (hasWarnings) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'safe';
    }

    // Add summary check
    if (checks.length === 0 || checks.every(check => check.passed)) {
      checks.push({
        checkType: 'overall_health',
        passed: true,
        message: 'All safety checks passed',
        severity: 'info'
      });
    }

    return {
      overallStatus,
      checks,
      timestamp: new Date()
    };
  }
);

// Emergency action endpoint for admins
export const emergencyAction = api<EmergencyAction, { success: boolean; message: string }>(
  { expose: true, method: "POST", path: "/fair-mint/safety/emergency" },
  async (req) => {
    // Verify admin authorization
    const expectedAdminWallet = adminWalletAddress();
    if (req.adminWallet !== expectedAdminWallet) {
      throw APIError.permissionDenied("Only authorized administrators can perform emergency actions");
    }

    const now = new Date();
    let success = false;
    let message = "";

    try {
      switch (req.action) {
        case 'pause':
          if (!req.parameters?.eventId) {
            throw APIError.invalidArgument("Event ID required for pause action");
          }
          
          await fairMintDB.exec`
            UPDATE fair_mint_events 
            SET is_active = false 
            WHERE id = ${req.parameters.eventId}
          `;
          
          await fairMintDB.exec`
            INSERT INTO fair_mint_pause_log (event_id, action, reason, admin_wallet)
            VALUES (${req.parameters.eventId}, 'emergency_pause', ${req.reason}, ${req.adminWallet})
          `;
          
          success = true;
          message = `Event ${req.parameters.eventId} has been emergency paused`;
          break;

        case 'resume':
          if (!req.parameters?.eventId) {
            throw APIError.invalidArgument("Event ID required for resume action");
          }
          
          await fairMintDB.exec`
            UPDATE fair_mint_events 
            SET is_active = true 
            WHERE id = ${req.parameters.eventId}
          `;
          
          await fairMintDB.exec`
            INSERT INTO fair_mint_pause_log (event_id, action, reason, admin_wallet)
            VALUES (${req.parameters.eventId}, 'emergency_resume', ${req.reason}, ${req.adminWallet})
          `;
          
          success = true;
          message = `Event ${req.parameters.eventId} has been resumed`;
          break;

        case 'cap_adjust':
          if (!req.parameters?.eventId || !req.parameters?.tokenMint || !req.parameters?.newCap) {
            throw APIError.invalidArgument("Event ID, token mint, and new cap required for cap adjustment");
          }
          
          const newCapValue = parseFloat(req.parameters.newCap);
          if (isNaN(newCapValue) || newCapValue <= 0) {
            throw APIError.invalidArgument("Invalid cap value");
          }
          
          await fairMintDB.exec`
            UPDATE fair_mint_accepted_tokens 
            SET daily_cap_usd = ${req.parameters.newCap}
            WHERE event_id = ${req.parameters.eventId} AND mint_address = ${req.parameters.tokenMint}
          `;
          
          await fairMintDB.exec`
            INSERT INTO fair_mint_pause_log (event_id, action, reason, admin_wallet)
            VALUES (${req.parameters.eventId}, 'emergency_cap_adjust', ${req.reason || `Adjusted cap to ${req.parameters.newCap}`}, ${req.adminWallet})
          `;
          
          success = true;
          message = `Daily cap for token ${req.parameters.tokenMint} adjusted to $${req.parameters.newCap}`;
          break;

        case 'token_disable':
          if (!req.parameters?.eventId || !req.parameters?.tokenMint) {
            throw APIError.invalidArgument("Event ID and token mint required for token disable");
          }
          
          await fairMintDB.exec`
            UPDATE fair_mint_accepted_tokens 
            SET is_active = false
            WHERE event_id = ${req.parameters.eventId} AND mint_address = ${req.parameters.tokenMint}
          `;
          
          await fairMintDB.exec`
            INSERT INTO fair_mint_pause_log (event_id, action, reason, admin_wallet)
            VALUES (${req.parameters.eventId}, 'emergency_token_disable', ${req.reason}, ${req.adminWallet})
          `;
          
          success = true;
          message = `Token ${req.parameters.tokenMint} has been disabled`;
          break;

        default:
          throw APIError.invalidArgument(`Unknown emergency action: ${req.action}`);
      }

      // Log the emergency action
      console.log(`Emergency action performed: ${req.action} by ${req.adminWallet}. Reason: ${req.reason}`);

    } catch (error) {
      console.error("Emergency action failed:", error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Emergency action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { success, message };
  }
);

// Automated daily cap reset function
export const resetDailyCaps = api<void, { resetsPerformed: number; errors: string[] }>(
  { expose: true, method: "POST", path: "/fair-mint/safety/reset-daily-caps" },
  async () => {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const tokensToReset = await fairMintDB.queryAll<{
      id: number;
      eventId: number;
      tokenSymbol: string;
      lastDailyReset: Date;
    }>`
      SELECT id, event_id as "eventId", token_symbol as "tokenSymbol", 
             last_daily_reset as "lastDailyReset"
      FROM fair_mint_accepted_tokens 
      WHERE is_active = true 
        AND last_daily_reset < ${oneDayAgo}
    `;

    let resetsPerformed = 0;
    const errors: string[] = [];

    for (const token of tokensToReset) {
      try {
        await fairMintDB.exec`
          UPDATE fair_mint_accepted_tokens 
          SET current_daily_burned_usd = 0, last_daily_reset = ${now}
          WHERE id = ${token.id}
        `;
        
        resetsPerformed++;
        console.log(`Reset daily cap for token ${token.tokenSymbol} in event ${token.eventId}`);
      } catch (error) {
        const errorMsg = `Failed to reset ${token.tokenSymbol}: ${error instanceof Error ? error.message : 'Unknown error'}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    return { resetsPerformed, errors };
  }
);
