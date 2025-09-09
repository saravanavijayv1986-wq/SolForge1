import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";

export interface RealtimeFairMintDashboard {
  eventOverview: {
    eventId: number;
    eventName: string;
    status: 'upcoming' | 'live' | 'ended' | 'finalized';
    timeRemaining: number; // seconds
    totalUsdBurned: string;
    totalParticipants: number;
    totalTransactions: number;
    burnVelocity: {
      current: string; // USD per hour
      peak: string;
      average: string;
    };
    progress: {
      timeProgress: number; // percentage
      participationRate: number; // burns per minute
    };
  };
  liveMetrics: {
    recentBurns: Array<{
      id: number;
      userWallet: string;
      tokenSymbol: string;
      usdValue: string;
      estimatedSolf: string;
      timestamp: Date;
      txSignature: string;
    }>;
    topBurners: Array<{
      userWallet: string;
      totalUsdBurned: string;
      totalSolfAllocated: string;
      burnCount: number;
      rank: number;
    }>;
    tokenPerformance: Array<{
      tokenSymbol: string;
      totalUsdBurned: string;
      burnCount: number;
      participantCount: number;
      dailyCapUtilization: number;
      avgBurnSize: string;
      priceStability: number; // percentage volatility
    }>;
  };
  safetyIndicators: {
    overallStatus: 'safe' | 'warning' | 'unsafe' | 'critical';
    alerts: Array<{
      level: 'info' | 'warning' | 'critical';
      message: string;
      timestamp: Date;
    }>;
    riskFactors: {
      priceVolatility: number;
      burnConcentration: number;
      velocityRisk: number;
      quoteTtlCompliance: number;
    };
  };
  marketData: {
    acceptedTokens: Array<{
      tokenSymbol: string;
      tokenName: string;
      mintAddress: string;
      currentPrice: string;
      priceSource: string;
      confidence: number;
      dailyCapUsd: string;
      currentDailyBurnedUsd: string;
      remainingCapUsd: string;
      isActive: boolean;
    }>;
  };
  timestamp: Date;
}

export interface RealTimeBurnStream {
  burns: Array<{
    id: number;
    userWallet: string;
    tokenSymbol: string;
    tokenName: string;
    tokenAmount: string;
    usdValue: string;
    estimatedSolf: string;
    priceAtBurn: string;
    priceSource: string;
    timestamp: Date;
    txSignature: string;
    eventId: number;
  }>;
  totalCount: number;
  filters: {
    minUsdValue?: string;
    tokenSymbol?: string;
    timeWindow?: number; // minutes
  };
}

export interface LeaderboardRealTime {
  topBurners: Array<{
    rank: number;
    userWallet: string;
    totalUsdBurned: string;
    totalSolfAllocated: string;
    burnCount: number;
    averageBurnSize: string;
    firstBurnTime: Date;
    lastBurnTime: Date;
    dominancePercentage: number;
  }>;
  tokenLeaderboard: Array<{
    rank: number;
    tokenSymbol: string;
    tokenName: string;
    totalUsdBurned: string;
    burnCount: number;
    participantCount: number;
    marketShare: number; // percentage of total USD burned
    avgBurnSize: string;
    peakBurnSize: string;
  }>;
  statistics: {
    totalEntries: number;
    medianBurnSize: string;
    giniCoefficient: number; // measure of inequality
    participationDiversity: number;
  };
}

// Real-time comprehensive dashboard data
export const getRealtimeDashboard = api<{ eventId?: number; includeHistory?: boolean }, RealtimeFairMintDashboard>(
  { expose: true, method: "GET", path: "/fair-mint/realtime/dashboard" },
  async (req) => {
    // Get active event if none specified
    let eventId = req.eventId;
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        throw APIError.notFound("No active fair mint event found");
      }
      eventId = activeEvent.id;
    }

    // Get event overview
    const event = await fairMintDB.queryRow<{
      id: number;
      eventName: string;
      startTime: Date;
      endTime: Date;
      isActive: boolean;
      isFinalized: boolean;
      totalUsdBurned: string;
    }>`
      SELECT id, event_name as "eventName", start_time as "startTime", 
             end_time as "endTime", is_active as "isActive", is_finalized as "isFinalized",
             total_usd_burned as "totalUsdBurned"
      FROM fair_mint_events WHERE id = ${eventId}
    `;

    if (!event) {
      throw APIError.notFound("Event not found");
    }

    // Determine event status and time remaining
    const now = new Date();
    let status: 'upcoming' | 'live' | 'ended' | 'finalized';
    let timeRemaining = 0;

    if (event.isFinalized) {
      status = 'finalized';
    } else if (now < event.startTime) {
      status = 'upcoming';
      timeRemaining = Math.floor((event.startTime.getTime() - now.getTime()) / 1000);
    } else if (now >= event.startTime && now < event.endTime) {
      status = 'live';
      timeRemaining = Math.floor((event.endTime.getTime() - now.getTime()) / 1000);
    } else {
      status = 'ended';
    }

    // Get participation metrics
    const participationMetrics = await fairMintDB.queryRow<{
      totalParticipants: number;
      totalTransactions: number;
    }>`
      SELECT 
        COUNT(DISTINCT user_wallet) as "totalParticipants",
        COUNT(*) as "totalTransactions"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId}
    `;

    // Calculate burn velocity metrics
    const velocityMetrics = await fairMintDB.queryAll<{
      hourBucket: string;
      hourlyBurnUsd: string;
    }>`
      SELECT 
        DATE_TRUNC('hour', burn_timestamp) as "hourBucket",
        SUM(usd_value_at_burn) as "hourlyBurnUsd"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId} 
        AND burn_timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', burn_timestamp)
      ORDER BY "hourBucket" DESC
    `;

    const currentHourlyBurn = velocityMetrics.length > 0 ? parseFloat(velocityMetrics[0].hourlyBurnUsd) : 0;
    const peakHourlyBurn = velocityMetrics.length > 0 ? Math.max(...velocityMetrics.map(v => parseFloat(v.hourlyBurnUsd))) : 0;
    const avgHourlyBurn = velocityMetrics.length > 0 ? velocityMetrics.reduce((sum, v) => sum + parseFloat(v.hourlyBurnUsd), 0) / velocityMetrics.length : 0;

    // Calculate progress metrics
    const totalEventDuration = event.endTime.getTime() - event.startTime.getTime();
    const elapsedTime = Math.max(0, now.getTime() - event.startTime.getTime());
    const timeProgress = totalEventDuration > 0 ? Math.min(100, (elapsedTime / totalEventDuration) * 100) : 0;

    // Get recent burns (last 20)
    const recentBurns = await fairMintDB.queryAll<{
      id: number;
      userWallet: string;
      tokenSymbol: string;
      usdValue: string;
      estimatedSolf: string;
      timestamp: Date;
      txSignature: string;
    }>`
      SELECT 
        b.id,
        b.user_wallet as "userWallet",
        t.token_symbol as "tokenSymbol",
        b.usd_value_at_burn as "usdValue",
        b.estimated_solf as "estimatedSolf",
        b.burn_timestamp as "timestamp",
        b.transaction_signature as "txSignature"
      FROM fair_mint_burns b
      JOIN fair_mint_accepted_tokens t ON b.token_mint_address = t.mint_address AND b.event_id = t.event_id
      WHERE b.event_id = ${eventId}
      ORDER BY b.burn_timestamp DESC
      LIMIT 20
    `;

    // Get top burners (top 10)
    const topBurners = await fairMintDB.queryAll<{
      userWallet: string;
      totalUsdBurned: string;
      totalSolfAllocated: string;
      burnCount: number;
      rank: number;
    }>`
      SELECT 
        user_wallet as "userWallet",
        total_usd_burned as "totalUsdBurned",
        total_solf_allocated as "totalSolfAllocated",
        (SELECT COUNT(*) FROM fair_mint_burns WHERE event_id = ${eventId} AND user_wallet = a.user_wallet) as "burnCount",
        ROW_NUMBER() OVER (ORDER BY CAST(total_usd_burned AS NUMERIC) DESC) as rank
      FROM fair_mint_allocations a
      WHERE event_id = ${eventId}
      ORDER BY CAST(total_usd_burned AS NUMERIC) DESC
      LIMIT 10
    `;

    // Get token performance metrics
    const tokenPerformance = await fairMintDB.queryAll<{
      tokenSymbol: string;
      totalUsdBurned: string;
      burnCount: number;
      participantCount: number;
      dailyCapUtilization: number;
      avgBurnSize: string;
      priceStability: number;
    }>`
      SELECT 
        t.token_symbol as "tokenSymbol",
        COALESCE(SUM(b.usd_value_at_burn), 0) as "totalUsdBurned",
        COUNT(b.id) as "burnCount",
        COUNT(DISTINCT b.user_wallet) as "participantCount",
        (CAST(t.current_daily_burned_usd AS NUMERIC) / CAST(t.daily_cap_usd AS NUMERIC) * 100) as "dailyCapUtilization",
        CASE 
          WHEN COUNT(b.id) > 0 THEN (SUM(b.usd_value_at_burn) / COUNT(b.id))::TEXT
          ELSE '0'
        END as "avgBurnSize",
        CASE 
          WHEN COUNT(b.id) > 2 THEN 
            ((MAX(CAST(b.price_at_burn AS NUMERIC)) - MIN(CAST(b.price_at_burn AS NUMERIC))) / 
             NULLIF(AVG(CAST(b.price_at_burn AS NUMERIC)), 0) * 100)
          ELSE 0
        END as "priceStability"
      FROM fair_mint_accepted_tokens t
      LEFT JOIN fair_mint_burns b ON t.mint_address = b.token_mint_address AND t.event_id = b.event_id
      WHERE t.event_id = ${eventId} AND t.is_active = true
      GROUP BY t.id, t.token_symbol, t.current_daily_burned_usd, t.daily_cap_usd
      ORDER BY COALESCE(SUM(b.usd_value_at_burn), 0) DESC
    `;

    // Safety indicators (simplified for real-time)
    const alertsData = await fairMintDB.queryAll<{
      level: string;
      message: string;
      timestamp: Date;
    }>`
      SELECT 
        CASE 
          WHEN severity = 'error' THEN 'critical'
          WHEN severity = 'warning' THEN 'warning'
          ELSE 'info'
        END as level,
        message,
        checked_at as timestamp
      FROM fair_mint_safety_logs
      WHERE event_id = ${eventId}
        AND checked_at >= NOW() - INTERVAL '1 hour'
        AND status != 'safe'
      ORDER BY checked_at DESC
      LIMIT 10
    `;

    // Market data for accepted tokens
    const acceptedTokens = await fairMintDB.queryAll<{
      tokenSymbol: string;
      tokenName: string;
      mintAddress: string;
      dailyCapUsd: string;
      currentDailyBurnedUsd: string;
      isActive: boolean;
    }>`
      SELECT 
        token_symbol as "tokenSymbol",
        token_name as "tokenName",
        mint_address as "mintAddress",
        daily_cap_usd as "dailyCapUsd",
        current_daily_burned_usd as "currentDailyBurnedUsd",
        is_active as "isActive"
      FROM fair_mint_accepted_tokens
      WHERE event_id = ${eventId}
      ORDER BY token_symbol
    `;

    // Calculate participation rate (burns per minute in last hour)
    const recentHourBurns = await fairMintDB.queryRow<{ burnCount: number }>`
      SELECT COUNT(*) as "burnCount"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId} 
        AND burn_timestamp >= NOW() - INTERVAL '1 hour'
    `;
    const participationRate = (recentHourBurns?.burnCount || 0) / 60; // per minute

    return {
      eventOverview: {
        eventId: event.id,
        eventName: event.eventName,
        status,
        timeRemaining,
        totalUsdBurned: event.totalUsdBurned,
        totalParticipants: participationMetrics?.totalParticipants || 0,
        totalTransactions: participationMetrics?.totalTransactions || 0,
        burnVelocity: {
          current: currentHourlyBurn.toString(),
          peak: peakHourlyBurn.toString(),
          average: avgHourlyBurn.toString(),
        },
        progress: {
          timeProgress,
          participationRate,
        },
      },
      liveMetrics: {
        recentBurns,
        topBurners,
        tokenPerformance,
      },
      safetyIndicators: {
        overallStatus: alertsData.length > 0 ? 'warning' : 'safe',
        alerts: alertsData.map(alert => ({
          level: alert.level as 'info' | 'warning' | 'critical',
          message: alert.message,
          timestamp: alert.timestamp,
        })),
        riskFactors: {
          priceVolatility: Math.max(...tokenPerformance.map(t => t.priceStability), 0),
          burnConcentration: topBurners.length > 0 ? parseFloat(topBurners[0]?.totalUsdBurned || '0') / parseFloat(event.totalUsdBurned) * 100 : 0,
          velocityRisk: currentHourlyBurn > 100000 ? 75 : currentHourlyBurn > 50000 ? 50 : 25,
          quoteTtlCompliance: 95, // Mock value - would need actual implementation
        },
      },
      marketData: {
        acceptedTokens: acceptedTokens.map(token => ({
          tokenSymbol: token.tokenSymbol,
          tokenName: token.tokenName,
          mintAddress: token.mintAddress,
          currentPrice: '0', // Would be fetched from pricing service
          priceSource: 'Raydium',
          confidence: 90,
          dailyCapUsd: token.dailyCapUsd,
          currentDailyBurnedUsd: token.currentDailyBurnedUsd,
          remainingCapUsd: (parseFloat(token.dailyCapUsd) - parseFloat(token.currentDailyBurnedUsd)).toString(),
          isActive: token.isActive,
        })),
      },
      timestamp: new Date(),
    };
  }
);

// Real-time burn stream with filtering
export const getRealTimeBurnStream = api<{
  eventId?: number;
  limit?: number;
  minUsdValue?: string;
  tokenSymbol?: string;
  timeWindow?: number; // minutes
}, RealTimeBurnStream>(
  { expose: true, method: "GET", path: "/fair-mint/realtime/burn-stream" },
  async (req) => {
    const limit = req.limit || 50;
    const timeWindow = req.timeWindow || 60; // Default 1 hour

    let eventId = req.eventId;
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        return {
          burns: [],
          totalCount: 0,
          filters: {
            minUsdValue: req.minUsdValue,
            tokenSymbol: req.tokenSymbol,
            timeWindow: req.timeWindow,
          },
        };
      }
      eventId = activeEvent.id;
    }

    // Build dynamic query based on filters
    let whereConditions = [`b.event_id = ${eventId}`];
    let queryParams: any[] = [];

    // Time window filter
    whereConditions.push(`b.burn_timestamp >= NOW() - INTERVAL '${timeWindow} minutes'`);

    // USD value filter
    if (req.minUsdValue) {
      whereConditions.push(`CAST(b.usd_value_at_burn AS NUMERIC) >= ${parseFloat(req.minUsdValue)}`);
    }

    // Token symbol filter
    if (req.tokenSymbol) {
      whereConditions.push(`t.token_symbol = '${req.tokenSymbol}'`);
    }

    const whereClause = whereConditions.join(' AND ');

    const burns = await fairMintDB.queryAll<{
      id: number;
      userWallet: string;
      tokenSymbol: string;
      tokenName: string;
      tokenAmount: string;
      usdValue: string;
      estimatedSolf: string;
      priceAtBurn: string;
      priceSource: string;
      timestamp: Date;
      txSignature: string;
      eventId: number;
    }>`
      SELECT 
        b.id,
        b.user_wallet as "userWallet",
        t.token_symbol as "tokenSymbol",
        t.token_name as "tokenName",
        b.token_amount as "tokenAmount",
        b.usd_value_at_burn as "usdValue",
        b.estimated_solf as "estimatedSolf",
        b.price_at_burn as "priceAtBurn",
        b.price_source as "priceSource",
        b.burn_timestamp as "timestamp",
        b.transaction_signature as "txSignature",
        b.event_id as "eventId"
      FROM fair_mint_burns b
      JOIN fair_mint_accepted_tokens t ON b.token_mint_address = t.mint_address AND b.event_id = t.event_id
      WHERE ${whereClause}
      ORDER BY b.burn_timestamp DESC
      LIMIT ${limit}
    `;

    // Get total count for pagination
    const countResult = await fairMintDB.queryRow<{ count: number }>`
      SELECT COUNT(*) as count
      FROM fair_mint_burns b
      JOIN fair_mint_accepted_tokens t ON b.token_mint_address = t.mint_address AND b.event_id = t.event_id
      WHERE ${whereClause}
    `;

    return {
      burns,
      totalCount: countResult?.count || 0,
      filters: {
        minUsdValue: req.minUsdValue,
        tokenSymbol: req.tokenSymbol,
        timeWindow,
      },
    };
  }
);

// Enhanced real-time leaderboard with analytics
export const getRealtimeLeaderboard = api<{ eventId?: number; topN?: number }, LeaderboardRealTime>(
  { expose: true, method: "GET", path: "/fair-mint/realtime/leaderboard" },
  async (req) => {
    const topN = req.topN || 20;

    let eventId = req.eventId;
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        return {
          topBurners: [],
          tokenLeaderboard: [],
          statistics: {
            totalEntries: 0,
            medianBurnSize: '0',
            giniCoefficient: 0,
            participationDiversity: 0,
          },
        };
      }
      eventId = activeEvent.id;
    }

    // Get enhanced top burners
    const topBurners = await fairMintDB.queryAll<{
      rank: number;
      userWallet: string;
      totalUsdBurned: string;
      totalSolfAllocated: string;
      burnCount: number;
      averageBurnSize: string;
      firstBurnTime: Date;
      lastBurnTime: Date;
      dominancePercentage: number;
    }>`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY CAST(a.total_usd_burned AS NUMERIC) DESC) as rank,
        a.user_wallet as "userWallet",
        a.total_usd_burned as "totalUsdBurned",
        a.total_solf_allocated as "totalSolfAllocated",
        burn_stats.burn_count as "burnCount",
        burn_stats.average_burn_size as "averageBurnSize",
        burn_stats.first_burn_time as "firstBurnTime",
        burn_stats.last_burn_time as "lastBurnTime",
        (CAST(a.total_usd_burned AS NUMERIC) / event_total.total * 100) as "dominancePercentage"
      FROM fair_mint_allocations a
      JOIN (
        SELECT 
          user_wallet,
          COUNT(*) as burn_count,
          AVG(CAST(usd_value_at_burn AS NUMERIC)) as average_burn_size,
          MIN(burn_timestamp) as first_burn_time,
          MAX(burn_timestamp) as last_burn_time
        FROM fair_mint_burns 
        WHERE event_id = ${eventId}
        GROUP BY user_wallet
      ) burn_stats ON a.user_wallet = burn_stats.user_wallet
      CROSS JOIN (
        SELECT SUM(CAST(total_usd_burned AS NUMERIC)) as total
        FROM fair_mint_allocations 
        WHERE event_id = ${eventId}
      ) event_total
      WHERE a.event_id = ${eventId}
      ORDER BY CAST(a.total_usd_burned AS NUMERIC) DESC
      LIMIT ${topN}
    `;

    // Get token leaderboard
    const tokenLeaderboard = await fairMintDB.queryAll<{
      rank: number;
      tokenSymbol: string;
      tokenName: string;
      totalUsdBurned: string;
      burnCount: number;
      participantCount: number;
      marketShare: number;
      avgBurnSize: string;
      peakBurnSize: string;
    }>`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY COALESCE(SUM(CAST(b.usd_value_at_burn AS NUMERIC)), 0) DESC) as rank,
        t.token_symbol as "tokenSymbol",
        t.token_name as "tokenName",
        COALESCE(SUM(b.usd_value_at_burn), 0)::TEXT as "totalUsdBurned",
        COUNT(b.id) as "burnCount",
        COUNT(DISTINCT b.user_wallet) as "participantCount",
        (COALESCE(SUM(CAST(b.usd_value_at_burn AS NUMERIC)), 0) / event_total.total * 100) as "marketShare",
        CASE 
          WHEN COUNT(b.id) > 0 THEN (SUM(CAST(b.usd_value_at_burn AS NUMERIC)) / COUNT(b.id))::TEXT
          ELSE '0'
        END as "avgBurnSize",
        COALESCE(MAX(CAST(b.usd_value_at_burn AS NUMERIC)), 0)::TEXT as "peakBurnSize"
      FROM fair_mint_accepted_tokens t
      LEFT JOIN fair_mint_burns b ON t.mint_address = b.token_mint_address AND t.event_id = b.event_id
      CROSS JOIN (
        SELECT NULLIF(SUM(CAST(usd_value_at_burn AS NUMERIC)), 0) as total
        FROM fair_mint_burns 
        WHERE event_id = ${eventId}
      ) event_total
      WHERE t.event_id = ${eventId} AND t.is_active = true
      GROUP BY t.id, t.token_symbol, t.token_name, event_total.total
      ORDER BY COALESCE(SUM(CAST(b.usd_value_at_burn AS NUMERIC)), 0) DESC
      LIMIT ${topN}
    `;

    // Calculate statistics
    const statisticsData = await fairMintDB.queryRow<{
      totalEntries: number;
      medianBurnSize: string;
      participationDiversity: number;
    }>`
      SELECT 
        COUNT(*) as "totalEntries",
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY CAST(usd_value_at_burn AS NUMERIC)) as "medianBurnSize",
        COUNT(DISTINCT user_wallet)::FLOAT / NULLIF(COUNT(*), 0) as "participationDiversity"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId}
    `;

    // Calculate Gini coefficient (simplified approximation)
    const burnAmounts = await fairMintDB.queryAll<{ amount: number }>`
      SELECT CAST(total_usd_burned AS NUMERIC) as amount
      FROM fair_mint_allocations 
      WHERE event_id = ${eventId}
      ORDER BY amount
    `;

    let giniCoefficient = 0;
    if (burnAmounts.length > 1) {
      const sortedAmounts = burnAmounts.map(b => b.amount).sort((a, b) => a - b);
      const n = sortedAmounts.length;
      const sum = sortedAmounts.reduce((acc, val) => acc + val, 0);
      
      if (sum > 0) {
        let numerator = 0;
        for (let i = 0; i < n; i++) {
          numerator += (i + 1) * sortedAmounts[i];
        }
        giniCoefficient = (2 * numerator) / (n * sum) - (n + 1) / n;
      }
    }

    return {
      topBurners,
      tokenLeaderboard,
      statistics: {
        totalEntries: statisticsData?.totalEntries || 0,
        medianBurnSize: statisticsData?.medianBurnSize || '0',
        giniCoefficient: Math.max(0, Math.min(1, giniCoefficient)),
        participationDiversity: statisticsData?.participationDiversity || 0,
      },
    };
  }
);

// Get real-time price data for accepted tokens
export const getRealtimeTokenPrices = api<{ eventId?: number }, { 
  tokens: Array<{
    tokenSymbol: string;
    mintAddress: string;
    currentPrice: string;
    priceSource: string;
    confidence: number;
    lastUpdate: Date;
    change24h?: number;
  }>;
  lastUpdate: Date;
}>(
  { expose: true, method: "GET", path: "/fair-mint/realtime/token-prices" },
  async (req) => {
    let eventId = req.eventId;
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        return { tokens: [], lastUpdate: new Date() };
      }
      eventId = activeEvent.id;
    }

    // Get accepted tokens
    const acceptedTokens = await fairMintDB.queryAll<{
      tokenSymbol: string;
      mintAddress: string;
    }>`
      SELECT token_symbol as "tokenSymbol", mint_address as "mintAddress"
      FROM fair_mint_accepted_tokens
      WHERE event_id = ${eventId} AND is_active = true
    `;

    // In a real implementation, this would fetch current prices from the pricing service
    // For now, returning mock data structure
    const tokens = acceptedTokens.map(token => ({
      tokenSymbol: token.tokenSymbol,
      mintAddress: token.mintAddress,
      currentPrice: '0.00', // Would be fetched from pricing service
      priceSource: 'Raydium',
      confidence: 90,
      lastUpdate: new Date(),
      change24h: 0,
    }));

    return {
      tokens,
      lastUpdate: new Date(),
    };
  }
);
