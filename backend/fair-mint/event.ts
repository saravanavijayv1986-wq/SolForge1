import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";

export interface FairMintEvent {
  id: number;
  eventName: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
  isFinalized: boolean;
  totalUsdBurned: string;
  totalSolfAllocated: string;
  solfPerUsdRate?: string;
  tgePercentage: number;
  vestingDays: number;
  platformFeeBps: number;
  maxPerWalletUsd: string;
  maxPerTxUsd: string;
  quoteTtlSeconds: number;
  minTxUsd: string;
  treasuryAddress: string;
  referralPoolPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface AcceptedToken {
  id: number;
  eventId: number;
  mintAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  isActive: boolean;
  dailyCapUsd: string;
  currentDailyBurnedUsd: string;
  lastDailyReset: Date;
  dexPriceSource?: string;
  createdAt: Date;
}

export interface GetActiveEventResponse {
  event: FairMintEvent | null;
  acceptedTokens: AcceptedToken[];
  isLive: boolean;
  timeRemaining?: number; // seconds
  status: 'upcoming' | 'live' | 'ended' | 'finalized';
}

export interface GetEventStatsResponse {
  totalParticipants: number;
  totalUsdBurned: string;
  totalTransactions: number;
  averageBurnUsd: string;
  topBurnsByToken: Array<{
    tokenSymbol: string;
    totalUsdBurned: string;
    transactionCount: number;
  }>;
}

// Gets the currently active fair mint event
export const getActiveEvent = api<void, GetActiveEventResponse>(
  { expose: true, method: "GET", path: "/fair-mint/active" },
  async () => {
    const event = await fairMintDB.queryRow<FairMintEvent>`
      SELECT 
        id, event_name as "eventName", description, start_time as "startTime", 
        end_time as "endTime", is_active as "isActive", is_finalized as "isFinalized",
        total_usd_burned as "totalUsdBurned", total_solf_allocated as "totalSolfAllocated",
        solf_per_usd_rate as "solfPerUsdRate", tge_percentage as "tgePercentage",
        vesting_days as "vestingDays", platform_fee_bps as "platformFeeBps",
        max_per_wallet_usd as "maxPerWalletUsd", max_per_tx_usd as "maxPerTxUsd",
        quote_ttl_seconds as "quoteTtlSeconds", min_tx_usd as "minTxUsd",
        treasury_address as "treasuryAddress", referral_pool_percentage as "referralPoolPercentage",
        created_at as "createdAt", updated_at as "updatedAt"
      FROM fair_mint_events 
      WHERE is_active = true 
      ORDER BY created_at DESC 
      LIMIT 1
    `;

    if (!event) {
      return {
        event: null,
        acceptedTokens: [],
        isLive: false,
        status: 'upcoming'
      };
    }

    const acceptedTokens = await fairMintDB.queryAll<AcceptedToken>`
      SELECT 
        id, event_id as "eventId", mint_address as "mintAddress",
        token_name as "tokenName", token_symbol as "tokenSymbol",
        token_logo_url as "tokenLogoUrl", is_active as "isActive",
        daily_cap_usd as "dailyCapUsd", current_daily_burned_usd as "currentDailyBurnedUsd",
        last_daily_reset as "lastDailyReset",
        dex_price_source as "dexPriceSource", created_at as "createdAt"
      FROM fair_mint_accepted_tokens 
      WHERE event_id = ${event.id} AND is_active = true
      ORDER BY token_symbol ASC
    `;

    const now = new Date();
    const startTime = new Date(event.startTime);
    const endTime = new Date(event.endTime);
    
    let status: 'upcoming' | 'live' | 'ended' | 'finalized';
    let timeRemaining: number | undefined;
    let isLive = false;

    if (event.isFinalized) {
      status = 'finalized';
    } else if (now < startTime) {
      status = 'upcoming';
      timeRemaining = Math.floor((startTime.getTime() - now.getTime()) / 1000);
    } else if (now >= startTime && now < endTime) {
      status = 'live';
      isLive = true;
      timeRemaining = Math.floor((endTime.getTime() - now.getTime()) / 1000);
    } else {
      status = 'ended';
    }

    return {
      event,
      acceptedTokens,
      isLive,
      timeRemaining,
      status
    };
  }
);

// Gets event statistics
export const getEventStats = api<{ eventId?: number }, GetEventStatsResponse>(
  { expose: true, method: "GET", path: "/fair-mint/stats" },
  async (req) => {
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

    const stats = await fairMintDB.queryRow<{
      totalParticipants: number;
      totalUsdBurned: string;
      totalTransactions: number;
      averageBurnUsd: string;
    }>`
      SELECT 
        COUNT(DISTINCT user_wallet) as "totalParticipants",
        COALESCE(SUM(usd_value_at_burn), 0)::TEXT as "totalUsdBurned",
        COUNT(*) as "totalTransactions",
        COALESCE(AVG(usd_value_at_burn), 0)::TEXT as "averageBurnUsd"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId}
    `;

    const topBurnsByToken = await fairMintDB.queryAll<{
      tokenSymbol: string;
      totalUsdBurned: string;
      transactionCount: number;
    }>`
      SELECT 
        t.token_symbol as "tokenSymbol",
        COALESCE(SUM(b.usd_value_at_burn), 0)::TEXT as "totalUsdBurned",
        COUNT(b.id) as "transactionCount"
      FROM fair_mint_accepted_tokens t
      LEFT JOIN fair_mint_burns b ON t.mint_address = b.token_mint_address AND b.event_id = ${eventId}
      WHERE t.event_id = ${eventId} AND t.is_active = true
      GROUP BY t.token_symbol
      ORDER BY COALESCE(SUM(b.usd_value_at_burn), 0) DESC
      LIMIT 10
    `;

    return {
      totalParticipants: stats?.totalParticipants || 0,
      totalUsdBurned: stats?.totalUsdBurned || '0',
      totalTransactions: stats?.totalTransactions || 0,
      averageBurnUsd: stats?.averageBurnUsd || '0',
      topBurnsByToken
    };
  }
);
