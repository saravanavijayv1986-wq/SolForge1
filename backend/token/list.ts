import { api, APIError } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { tokenDB } from "./db";

export interface ListTokensRequest {
  creatorWallet?: Query<string>;
  holderWallet?: Query<string>;
  limit?: Query<number>;
  offset?: Query<number>;
}

export interface ListTokensResponse {
  tokens: TokenInfo[];
  total: number;
  hasMore: boolean;
}

export interface TokenInfo {
  id: number;
  mintAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description?: string;
  logoUrl?: string;
  metadataUrl?: string;
  creatorWallet: string;
  totalMinted: string;
  isMintable: boolean;
  isFrozen: boolean;
  userBalance?: string;
  createdAt: Date;
}

// Lists tokens with optional filtering
export const list = api<ListTokensRequest, ListTokensResponse>(
  { expose: true, method: "GET", path: "/token/list" },
  async (req) => {
    try {
      console.log("Token list request:", req);

      const limit = Math.min(Math.max(req.limit || 20, 1), 100); // Between 1 and 100
      const offset = Math.max(req.offset || 0, 0); // Ensure non-negative
      
      // Test database connection
      try {
        await tokenDB.queryRow`SELECT 1 as test`;
        console.log("Database connection test successful");
      } catch (dbError) {
        console.error("Database connection test failed:", dbError);
        throw APIError.unavailable("Database is currently unavailable", { originalError: dbError instanceof Error ? dbError.message : String(dbError) });
      }

      // Simple query without complex joins initially
      let query = `
        SELECT 
          t.id,
          t.mint_address as "mintAddress",
          t.name,
          t.symbol,
          t.decimals,
          t.supply,
          t.description,
          t.logo_url as "logoUrl",
          t.metadata_url as "metadataUrl",
          t.creator_wallet as "creatorWallet",
          COALESCE(t.total_minted, '0') as "totalMinted",
          COALESCE(t.is_mintable, true) as "isMintable",
          COALESCE(t.is_frozen, false) as "isFrozen",
          t.created_at as "createdAt"
        FROM tokens t
      `;

      let countQuery = `SELECT COUNT(*) as count FROM tokens t`;
      const params: any[] = [];
      const whereConditions: string[] = [];
      let paramIndex = 1;

      // Add creator wallet filter
      if (req.creatorWallet && req.creatorWallet.trim()) {
        whereConditions.push(`t.creator_wallet = $${paramIndex}`);
        params.push(req.creatorWallet.trim());
        paramIndex++;
      }

      // Add WHERE clause if we have conditions
      if (whereConditions.length > 0) {
        const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
        query += whereClause;
        countQuery += whereClause;
      }

      query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
      params.push(limit, offset);

      // For count query, use same params except limit/offset
      const countParams = params.slice(0, -2);

      console.log("Executing queries with params:", params);

      const [tokens, countResult] = await Promise.all([
        tokenDB.rawQueryAll<TokenInfo>(query, ...params),
        tokenDB.rawQueryRow<{ count: number }>(countQuery, ...countParams)
      ]);

      const total = Number(countResult?.count || 0);
      const hasMore = offset + tokens.length < total;

      console.log(`Query returned ${tokens.length} tokens, total: ${total}`);

      return {
        tokens: tokens || [],
        total,
        hasMore
      };

    } catch (error) {
      console.error("Token list error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve tokens", { originalError: error instanceof Error ? error.message : String(error) });
    }
  }
);
