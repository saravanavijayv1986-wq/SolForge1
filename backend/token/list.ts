import { api } from "encore.dev/api";
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
    const limit = req.limit || 20;
    const offset = req.offset || 0;
    
    let query = `
      SELECT DISTINCT
        t.id, t.mint_address as "mintAddress", t.name, t.symbol, t.decimals, t.supply, 
        t.description, t.logo_url as "logoUrl", t.metadata_url as "metadataUrl",
        t.creator_wallet as "creatorWallet", t.total_minted as "totalMinted",
        t.is_mintable as "isMintable", t.is_frozen as "isFrozen", t.created_at as "createdAt"
    `;
    
    // Add user balance if holderWallet is specified
    if (req.holderWallet) {
      query += `, COALESCE(tb.balance, '0') as "userBalance"`;
    }
    
    query += ` FROM tokens t`;
    
    // Join with balances if looking for holder's tokens
    if (req.holderWallet) {
      query += ` LEFT JOIN token_balances tb ON t.id = tb.token_id AND tb.wallet_address = $1`;
    }
    
    let countQuery = `SELECT COUNT(DISTINCT t.id) as count FROM tokens t`;
    const params: any[] = [];
    let paramIndex = req.holderWallet ? 2 : 1;
    let whereConditions: string[] = [];
    
    // Add holder wallet parameter first if specified
    if (req.holderWallet) {
      params.unshift(req.holderWallet);
      countQuery += ` LEFT JOIN token_balances tb ON t.id = tb.token_id AND tb.wallet_address = $1`;
    }
    
    // Add creator wallet filter
    if (req.creatorWallet) {
      whereConditions.push(`t.creator_wallet = $${paramIndex}`);
      params.push(req.creatorWallet);
      paramIndex++;
    }
    
    // If looking for holder's tokens, filter for tokens they have balance in OR created
    if (req.holderWallet && !req.creatorWallet) {
      whereConditions.push(`(tb.balance IS NOT NULL AND CAST(tb.balance AS NUMERIC) > 0) OR t.creator_wallet = $1`);
    }
    
    // Add WHERE clause if we have conditions
    if (whereConditions.length > 0) {
      const whereClause = ` WHERE ${whereConditions.join(' AND ')}`;
      query += whereClause;
      countQuery += whereClause;
    }
    
    query += ` ORDER BY t.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    // For count query, we don't need the LIMIT and OFFSET params
    const countParams = params.slice(0, -2);
    
    const [tokens, countResult] = await Promise.all([
      tokenDB.rawQueryAll<TokenInfo>(query, ...params),
      tokenDB.rawQueryRow<{ count: number }>(countQuery, ...countParams)
    ]);
    
    const total = countResult?.count || 0;
    const hasMore = offset + tokens.length < total;
    
    return {
      tokens,
      total,
      hasMore
    };
  }
);
