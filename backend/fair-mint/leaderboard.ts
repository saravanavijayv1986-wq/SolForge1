import { api } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { fairMintDB } from "./db";

export interface LeaderboardEntry {
  rank: number;
  userWallet: string;
  totalUsdBurned: string;
  totalSolfAllocated: string;
  transactionCount: number;
  lastBurnTimestamp: Date;
}

export interface GetLeaderboardRequest {
  eventId?: Query<number>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export interface GetLeaderboardResponse {
  entries: LeaderboardEntry[];
  total: number;
  hasMore: boolean;
}

export interface TokenLeaderboardEntry {
  tokenSymbol: string;
  tokenName: string;
  totalUsdBurned: string;
  transactionCount: number;
  participantCount: number;
  averageBurnUsd: string;
}

export interface GetTokenLeaderboardResponse {
  entries: TokenLeaderboardEntry[];
}

// Gets the user leaderboard for the fair mint event
export const getLeaderboard = api<GetLeaderboardRequest, GetLeaderboardResponse>(
  { expose: true, method: "GET", path: "/fair-mint/leaderboard" },
  async (req) => {
    const limit = req.limit || 50;
    const offset = req.offset || 0;
    
    let eventId = req.eventId;
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        return {
          entries: [],
          total: 0,
          hasMore: false
        };
      }
      eventId = activeEvent.id;
    }

    const entries = await fairMintDB.queryAll<LeaderboardEntry>`
      SELECT 
        ROW_NUMBER() OVER (ORDER BY a.total_usd_burned DESC, a.created_at ASC) as rank,
        a.user_wallet as "userWallet",
        a.total_usd_burned as "totalUsdBurned",
        a.total_solf_allocated as "totalSolfAllocated",
        burn_counts.transaction_count as "transactionCount",
        burn_counts.last_burn_timestamp as "lastBurnTimestamp"
      FROM fair_mint_allocations a
      JOIN (
        SELECT 
          user_wallet,
          COUNT(*) as transaction_count,
          MAX(burn_timestamp) as last_burn_timestamp
        FROM fair_mint_burns 
        WHERE event_id = ${eventId}
        GROUP BY user_wallet
      ) burn_counts ON a.user_wallet = burn_counts.user_wallet
      WHERE a.event_id = ${eventId}
      ORDER BY a.total_usd_burned DESC, a.created_at ASC
      LIMIT ${limit} OFFSET ${offset}
    `;

    const countResult = await fairMintDB.queryRow<{ total: number }>`
      SELECT COUNT(*) as total
      FROM fair_mint_allocations 
      WHERE event_id = ${eventId}
    `;

    const total = countResult?.total || 0;
    const hasMore = offset + entries.length < total;

    return {
      entries,
      total,
      hasMore
    };
  }
);

// Gets the token leaderboard showing burn statistics by token
export const getTokenLeaderboard = api<{ eventId?: Query<number> }, GetTokenLeaderboardResponse>(
  { expose: true, method: "GET", path: "/fair-mint/token-leaderboard" },
  async (req) => {
    let eventId = req.eventId;
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        return { entries: [] };
      }
      eventId = activeEvent.id;
    }

    const entries = await fairMintDB.queryAll<TokenLeaderboardEntry>`
      SELECT 
        t.token_symbol as "tokenSymbol",
        t.token_name as "tokenName",
        COALESCE(stats.total_usd_burned, 0)::TEXT as "totalUsdBurned",
        COALESCE(stats.transaction_count, 0) as "transactionCount",
        COALESCE(stats.participant_count, 0) as "participantCount",
        COALESCE(stats.average_burn_usd, 0)::TEXT as "averageBurnUsd"
      FROM fair_mint_accepted_tokens t
      LEFT JOIN (
        SELECT 
          token_mint_address,
          SUM(usd_value_at_burn) as total_usd_burned,
          COUNT(*) as transaction_count,
          COUNT(DISTINCT user_wallet) as participant_count,
          AVG(usd_value_at_burn) as average_burn_usd
        FROM fair_mint_burns 
        WHERE event_id = ${eventId}
        GROUP BY token_mint_address
      ) stats ON t.mint_address = stats.token_mint_address
      WHERE t.event_id = ${eventId} AND t.is_active = true
      ORDER BY COALESCE(stats.total_usd_burned, 0) DESC, t.token_symbol ASC
    `;

    return { entries };
  }
);
