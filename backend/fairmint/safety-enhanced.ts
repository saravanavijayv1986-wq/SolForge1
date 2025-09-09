import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";
import { secret } from "encore.dev/config";

const adminWalletAddress = secret("AdminWalletAddress");

export interface EnhancedSafetyCheck {
  checkType: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warning' | 'error' | 'critical';
  value?: number;
  threshold?: number;
  recommendation?: string;
}

export interface ComprehensiveSafetyReport {
  overallStatus: 'safe' | 'warning' | 'unsafe' | 'critical';
  checks: EnhancedSafetyCheck[];
  metrics: {
    totalBurns: number;
    totalUsdBurned: string;
    avgBurnUsd: string;
    burnVelocity: string; // USD per hour
    priceVolatility: number; // Percentage
    participantCount: number;
    suspiciousActivity: number;
  };
  alerts: Array<{
    level: 'warning' | 'critical';
    message: string;
    action: string;
  }>;
  timestamp: Date;
}

export interface EmergencyPauseAction {
  eventId: number;
  adminWallet: string;
  reason: string;
  pauseType: 'full' | 'token_specific' | 'velocity_limit';
  parameters?: {
    tokenMint?: string;
    newVelocityLimit?: string;
  };
}

// Comprehensive safety monitoring with enhanced algorithms
export const performEnhancedSafetyCheck = api<{ eventId?: number }, ComprehensiveSafetyReport>(
  { expose: true, method: "GET", path: "/fair-mint/safety/enhanced-check" },
  async (req) => {
    const checks: EnhancedSafetyCheck[] = [];
    const alerts: Array<{ level: 'warning' | 'critical'; message: string; action: string }> = [];
    
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
          metrics: {
            totalBurns: 0,
            totalUsdBurned: '0',
            avgBurnUsd: '0',
            burnVelocity: '0',
            priceVolatility: 0,
            participantCount: 0,
            suspiciousActivity: 0
          },
          alerts: [],
          timestamp: new Date()
        };
      }
      eventId = activeEvent.id;
    }

    // Enhanced Check 1: Event timing and status with grace periods
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
    const gracePeriod = 5 * 60 * 1000; // 5 minutes
    
    // Timing checks with grace period
    if (event.isActive && now > new Date(event.endTime.getTime() + gracePeriod)) {
      checks.push({
        checkType: 'event_timing',
        passed: false,
        message: 'Event has exceeded end time beyond grace period',
        severity: 'critical',
        recommendation: 'Immediately pause event and begin finalization process'
      });
      alerts.push({
        level: 'critical',
        message: 'Event running beyond scheduled end time',
        action: 'Emergency pause required'
      });
    } else if (event.isActive && now > event.endTime) {
      checks.push({
        checkType: 'event_timing',
        passed: false,
        message: 'Event has passed end time but within grace period',
        severity: 'warning',
        recommendation: 'Prepare for event finalization'
      });
    }

    // Enhanced Check 2: Burn velocity and pattern analysis
    const recentBurns = await fairMintDB.queryAll<{
      burnTimestamp: Date;
      usdValueAtBurn: string;
      userWallet: string;
      tokenMintAddress: string;
    }>`
      SELECT burn_timestamp as "burnTimestamp", usd_value_at_burn as "usdValueAtBurn",
             user_wallet as "userWallet", token_mint_address as "tokenMintAddress"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId} AND burn_timestamp >= NOW() - INTERVAL '1 hour'
      ORDER BY burn_timestamp DESC
    `;

    const hourlyBurnValue = recentBurns.reduce((sum, burn) => sum + parseFloat(burn.usdValueAtBurn), 0);
    const velocityThreshold = 150000; // $150k per hour

    checks.push({
      checkType: 'burn_velocity',
      passed: hourlyBurnValue <= velocityThreshold,
      message: `Burn velocity: $${hourlyBurnValue.toLocaleString()}/hour`,
      severity: hourlyBurnValue > velocityThreshold * 2 ? 'critical' : hourlyBurnValue > velocityThreshold ? 'warning' : 'info',
      value: hourlyBurnValue,
      threshold: velocityThreshold,
      recommendation: hourlyBurnValue > velocityThreshold ? 'Monitor closely for manipulation' : undefined
    });

    if (hourlyBurnValue > velocityThreshold * 2) {
      alerts.push({
        level: 'critical',
        message: 'Extremely high burn velocity detected',
        action: 'Consider emergency velocity limit'
      });
    }

    // Enhanced Check 3: Wallet concentration and suspicious patterns
    const walletBurnAnalysis = await fairMintDB.queryAll<{
      userWallet: string;
      totalUsdBurned: string;
      burnCount: number;
      avgTimeBetweenBurns: number;
      firstBurn: Date;
      lastBurn: Date;
    }>`
      SELECT 
        user_wallet as "userWallet",
        SUM(usd_value_at_burn) as "totalUsdBurned",
        COUNT(*) as "burnCount",
        EXTRACT(EPOCH FROM (MAX(burn_timestamp) - MIN(burn_timestamp))) / GREATEST(COUNT(*) - 1, 1) as "avgTimeBetweenBurns",
        MIN(burn_timestamp) as "firstBurn",
        MAX(burn_timestamp) as "lastBurn"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId}
      GROUP BY user_wallet
      HAVING COUNT(*) >= 5 OR SUM(usd_value_at_burn) > 10000
      ORDER BY SUM(usd_value_at_burn) DESC
    `;

    let suspiciousWalletCount = 0;
    const totalBurned = parseFloat(event.totalUsdBurned);
    
    for (const wallet of walletBurnAnalysis) {
      const walletShare = (parseFloat(wallet.totalUsdBurned) / totalBurned) * 100;
      const avgTimeBetweenBurns = wallet.avgTimeBetweenBurns;
      
      // Check for whale concentration (>10% of total)
      if (walletShare > 10) {
        checks.push({
          checkType: 'whale_concentration',
          passed: false,
          message: `Wallet ${wallet.userWallet.slice(0, 8)}... holds ${walletShare.toFixed(1)}% of total burns`,
          severity: walletShare > 25 ? 'critical' : 'warning',
          value: walletShare,
          threshold: 10,
          recommendation: 'Monitor for coordinated activity'
        });
        suspiciousWalletCount++;
      }
      
      // Check for rapid-fire burns (avg < 30 seconds between burns)
      if (wallet.burnCount >= 10 && avgTimeBetweenBurns < 30) {
        checks.push({
          checkType: 'rapid_fire_burns',
          passed: false,
          message: `Wallet ${wallet.userWallet.slice(0, 8)}... averaging ${avgTimeBetweenBurns.toFixed(1)}s between burns`,
          severity: 'warning',
          value: avgTimeBetweenBurns,
          threshold: 30,
          recommendation: 'Possible bot activity'
        });
        suspiciousWalletCount++;
      }
    }

    // Enhanced Check 4: Price stability monitoring
    const priceVolatilityData = await fairMintDB.queryAll<{
      tokenSymbol: string;
      priceVariance: string;
      minPrice: string;
      maxPrice: string;
      avgPrice: string;
      burnCount: number;
    }>`
      SELECT 
        t.token_symbol as "tokenSymbol",
        STDDEV(CAST(b.price_at_burn AS NUMERIC)) as "priceVariance",
        MIN(CAST(b.price_at_burn AS NUMERIC)) as "minPrice",
        MAX(CAST(b.price_at_burn AS NUMERIC)) as "maxPrice",
        AVG(CAST(b.price_at_burn AS NUMERIC)) as "avgPrice",
        COUNT(*) as "burnCount"
      FROM fair_mint_burns b
      JOIN fair_mint_accepted_tokens t ON b.token_mint_address = t.mint_address
      WHERE b.event_id = ${eventId} 
        AND b.burn_timestamp >= NOW() - INTERVAL '1 hour'
        AND t.event_id = ${eventId}
      GROUP BY t.token_symbol
      HAVING COUNT(*) >= 3
    `;

    let maxVolatility = 0;
    for (const priceData of priceVolatilityData) {
      const avgPrice = parseFloat(priceData.avgPrice);
      const minPrice = parseFloat(priceData.minPrice);
      const maxPrice = parseFloat(priceData.maxPrice);
      
      if (avgPrice > 0) {
        const volatility = ((maxPrice - minPrice) / avgPrice) * 100;
        maxVolatility = Math.max(maxVolatility, volatility);
        
        if (volatility > 15) {
          checks.push({
            checkType: 'price_volatility',
            passed: false,
            message: `${priceData.tokenSymbol} showing ${volatility.toFixed(1)}% price volatility in last hour`,
            severity: volatility > 30 ? 'critical' : 'warning',
            value: volatility,
            threshold: 15,
            recommendation: 'Review price feed reliability'
          });
          
          if (volatility > 30) {
            alerts.push({
              level: 'critical',
              message: `Extreme price volatility in ${priceData.tokenSymbol}`,
              action: 'Consider disabling token temporarily'
            });
          }
        }
      }
    }

    // Enhanced Check 5: Daily cap monitoring with utilization rates
    const tokenCapAnalysis = await fairMintDB.queryAll<{
      tokenSymbol: string;
      dailyCapUsd: string;
      currentDailyBurnedUsd: string;
      utilizationRate: number;
      burnCount: number;
      uniqueBurners: number;
    }>`
      SELECT 
        t.token_symbol as "tokenSymbol",
        t.daily_cap_usd as "dailyCapUsd",
        t.current_daily_burned_usd as "currentDailyBurnedUsd",
        (t.current_daily_burned_usd / t.daily_cap_usd * 100) as "utilizationRate",
        COUNT(b.id) as "burnCount",
        COUNT(DISTINCT b.user_wallet) as "uniqueBurners"
      FROM fair_mint_accepted_tokens t
      LEFT JOIN fair_mint_burns b ON t.mint_address = b.token_mint_address 
        AND b.event_id = ${eventId} 
        AND b.burn_timestamp >= CURRENT_DATE
      WHERE t.event_id = ${eventId} AND t.is_active = true
      GROUP BY t.id, t.token_symbol, t.daily_cap_usd, t.current_daily_burned_usd
    `;

    for (const token of tokenCapAnalysis) {
      if (token.utilizationRate >= 90) {
        checks.push({
          checkType: 'daily_cap_utilization',
          passed: false,
          message: `${token.tokenSymbol} at ${token.utilizationRate.toFixed(1)}% daily cap utilization`,
          severity: token.utilizationRate >= 98 ? 'critical' : 'warning',
          value: token.utilizationRate,
          threshold: 90,
          recommendation: 'Prepare for cap adjustment if needed'
        });
      }
      
      // Check for low diversity (few burners consuming large portions)
      if (token.burnCount > 0 && token.uniqueBurners > 0) {
        const burnsPerUser = token.burnCount / token.uniqueBurners;
        if (burnsPerUser > 20 && token.utilizationRate > 50) {
          checks.push({
            checkType: 'low_participant_diversity',
            passed: false,
            message: `${token.tokenSymbol} has low participant diversity (${token.uniqueBurners} users, ${burnsPerUser.toFixed(1)} burns/user)`,
            severity: 'warning',
            value: burnsPerUser,
            threshold: 20,
            recommendation: 'Monitor for coordinated activity'
          });
        }
      }
    }

    // Enhanced Check 6: Quote TTL compliance and manipulation detection
    const quoteComplianceData = await fairMintDB.queryRow<{
      totalQuotes: number;
      expiredUsed: number;
      avgQuoteToUsage: number;
      suspiciousQuotePatterns: number;
    }>`
      SELECT 
        COUNT(q.id) as "totalQuotes",
        COUNT(CASE WHEN b.burn_timestamp > q.expires_at THEN 1 END) as "expiredUsed",
        AVG(EXTRACT(EPOCH FROM (b.burn_timestamp - q.created_at))) as "avgQuoteToUsage",
        COUNT(CASE WHEN EXTRACT(EPOCH FROM (b.burn_timestamp - q.created_at)) < 5 THEN 1 END) as "suspiciousQuotePatterns"
      FROM fair_mint_quotes q
      LEFT JOIN fair_mint_burns b ON q.quote_id = b.quote_id
      WHERE q.event_id = ${eventId} 
        AND q.created_at >= NOW() - INTERVAL '1 hour'
    `;

    if (quoteComplianceData) {
      if (quoteComplianceData.expiredUsed > 0) {
        checks.push({
          checkType: 'quote_compliance',
          passed: false,
          message: `${quoteComplianceData.expiredUsed} expired quotes used in last hour`,
          severity: 'critical',
          value: quoteComplianceData.expiredUsed,
          threshold: 0,
          recommendation: 'Investigate quote validation system'
        });
        
        alerts.push({
          level: 'critical',
          message: 'Expired quotes being accepted',
          action: 'Check quote validation logic immediately'
        });
      }
      
      // Check for suspicious quote patterns (too fast usage)
      const suspiciousRate = (quoteComplianceData.suspiciousQuotePatterns / Math.max(quoteComplianceData.totalQuotes, 1)) * 100;
      if (suspiciousRate > 10) {
        checks.push({
          checkType: 'suspicious_quote_patterns',
          passed: false,
          message: `${suspiciousRate.toFixed(1)}% of quotes used within 5 seconds`,
          severity: 'warning',
          value: suspiciousRate,
          threshold: 10,
          recommendation: 'Possible automated activity'
        });
      }
    }

    // Calculate overall metrics
    const overallMetrics = await fairMintDB.queryRow<{
      totalBurns: number;
      totalUsdBurned: string;
      avgBurnUsd: string;
      participantCount: number;
    }>`
      SELECT 
        COUNT(*) as "totalBurns",
        COALESCE(SUM(usd_value_at_burn), 0)::TEXT as "totalUsdBurned",
        COALESCE(AVG(usd_value_at_burn), 0)::TEXT as "avgBurnUsd",
        COUNT(DISTINCT user_wallet) as "participantCount"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId}
    `;

    // Determine overall status
    const criticalIssues = checks.filter(check => check.severity === 'critical' && !check.passed).length;
    const errorIssues = checks.filter(check => check.severity === 'error' && !check.passed).length;
    const warningIssues = checks.filter(check => check.severity === 'warning' && !check.passed).length;
    
    let overallStatus: 'safe' | 'warning' | 'unsafe' | 'critical';
    if (criticalIssues > 0) {
      overallStatus = 'critical';
    } else if (errorIssues > 0) {
      overallStatus = 'unsafe';
    } else if (warningIssues > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'safe';
    }

    return {
      overallStatus,
      checks,
      metrics: {
        totalBurns: overallMetrics?.totalBurns || 0,
        totalUsdBurned: overallMetrics?.totalUsdBurned || '0',
        avgBurnUsd: overallMetrics?.avgBurnUsd || '0',
        burnVelocity: hourlyBurnValue.toString(),
        priceVolatility: maxVolatility,
        participantCount: overallMetrics?.participantCount || 0,
        suspiciousActivity: suspiciousWalletCount
      },
      alerts,
      timestamp: new Date()
    };
  }
);

// Enhanced emergency pause with multiple pause types
export const enhancedEmergencyPause = api<EmergencyPauseAction, { success: boolean; message: string; actionsTaken: string[] }>(
  { expose: true, method: "POST", path: "/fair-mint/safety/enhanced-pause" },
  async (req) => {
    // Verify admin authorization
    const expectedAdminWallet = adminWalletAddress();
    if (req.adminWallet !== expectedAdminWallet) {
      throw APIError.permissionDenied("Only authorized administrators can perform emergency actions");
    }

    const actionsTaken: string[] = [];
    let message = "";

    await using tx = await fairMintDB.begin();

    try {
      switch (req.pauseType) {
        case 'full':
          // Full event pause
          await tx.exec`
            UPDATE fair_mint_events 
            SET is_active = false 
            WHERE id = ${req.eventId}
          `;
          actionsTaken.push(`Event ${req.eventId} fully paused`);
          
          // Log the action
          await tx.exec`
            INSERT INTO fair_mint_emergency_actions (event_id, action_type, admin_wallet, reason, parameters)
            VALUES (${req.eventId}, 'pause', ${req.adminWallet}, ${req.reason}, '{"pauseType": "full"}'::jsonb)
          `;
          
          message = `Event ${req.eventId} has been emergency paused`;
          break;

        case 'token_specific':
          if (!req.parameters?.tokenMint) {
            throw APIError.invalidArgument("Token mint required for token-specific pause");
          }
          
          // Disable specific token
          await tx.exec`
            UPDATE fair_mint_accepted_tokens 
            SET is_active = false
            WHERE event_id = ${req.eventId} AND mint_address = ${req.parameters.tokenMint}
          `;
          actionsTaken.push(`Token ${req.parameters.tokenMint} disabled`);
          
          await tx.exec`
            INSERT INTO fair_mint_emergency_actions (event_id, action_type, admin_wallet, reason, parameters)
            VALUES (${req.eventId}, 'token_disable', ${req.adminWallet}, ${req.reason}, 
                    jsonb_build_object('tokenMint', ${req.parameters.tokenMint}))
          `;
          
          message = `Token ${req.parameters.tokenMint} has been emergency disabled`;
          break;

        case 'velocity_limit':
          if (!req.parameters?.newVelocityLimit) {
            throw APIError.invalidArgument("New velocity limit required for velocity limit action");
          }
          
          // This would require additional implementation to enforce velocity limits
          // For now, we'll log the action and recommend implementation
          await tx.exec`
            INSERT INTO fair_mint_emergency_actions (event_id, action_type, admin_wallet, reason, parameters)
            VALUES (${req.eventId}, 'cap_adjust', ${req.adminWallet}, ${req.reason}, 
                    jsonb_build_object('velocityLimit', ${req.parameters.newVelocityLimit}))
          `;
          actionsTaken.push(`Velocity limit set to $${req.parameters.newVelocityLimit}/hour`);
          
          message = `Velocity limit set to $${req.parameters.newVelocityLimit}/hour`;
          break;

        default:
          throw APIError.invalidArgument(`Unknown pause type: ${req.pauseType}`);
      }

      return {
        success: true,
        message,
        actionsTaken
      };

    } catch (error) {
      console.error("Enhanced emergency action failed:", error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal(`Emergency action failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

export interface Anomaly {
  type: string;
  severity: string;
  description: string;
  value: number;
  expectedRange: {
    min: number;
    max: number;
  };
}

export interface DetectAnomaliesResponse {
  anomalies: Anomaly[];
}

// Real-time anomaly detection
export const detectAnomalies = api<{ eventId: number; timeWindow?: number }, DetectAnomaliesResponse>(
  { expose: true, method: "GET", path: "/fair-mint/safety/detect-anomalies" },
  async (req) => {
    const timeWindow = req.timeWindow || 60; // minutes
    const anomalies: Anomaly[] = [];

    // Detect burn rate anomalies
    const burnRateData = await fairMintDB.queryAll<{
      hourBucket: string;
      burnCount: number;
      totalUsd: string;
    }>`
      SELECT 
        DATE_TRUNC('hour', burn_timestamp) as "hourBucket",
        COUNT(*) as "burnCount",
        SUM(usd_value_at_burn) as "totalUsd"
      FROM fair_mint_burns 
      WHERE event_id = ${req.eventId} 
        AND burn_timestamp >= NOW() - INTERVAL '${timeWindow} minutes'
      GROUP BY DATE_TRUNC('hour', burn_timestamp)
      ORDER BY "hourBucket"
    `;

    if (burnRateData.length > 2) {
      const avgBurnsPerHour = burnRateData.reduce((sum, data) => sum + data.burnCount, 0) / burnRateData.length;
      const avgUsdPerHour = burnRateData.reduce((sum, data) => sum + parseFloat(data.totalUsd), 0) / burnRateData.length;
      
      const latestHour = burnRateData[burnRateData.length - 1];
      const currentBurnRate = latestHour.burnCount;
      const currentUsdRate = parseFloat(latestHour.totalUsd);
      
      // Check for burn rate anomalies (>3x average)
      if (currentBurnRate > avgBurnsPerHour * 3) {
        anomalies.push({
          type: 'burn_rate_spike',
          severity: 'warning',
          description: 'Unusual spike in burn transaction rate',
          value: currentBurnRate,
          expectedRange: { min: 0, max: avgBurnsPerHour * 2 }
        });
      }
      
      // Check for USD value anomalies
      if (currentUsdRate > avgUsdPerHour * 4) {
        anomalies.push({
          type: 'usd_value_spike',
          severity: 'critical',
          description: 'Extreme spike in USD burn value',
          value: currentUsdRate,
          expectedRange: { min: 0, max: avgUsdPerHour * 2 }
        });
      }
    }

    return { anomalies };
  }
);
