import { api, APIError } from "encore.dev/api";
import { tokenDB } from "./db";

export interface UpdateTokenRequest {
  mintAddress: string;
  updaterWallet: string;
  isMintable?: boolean;
  isFrozen?: boolean;
}

export interface UpdateTokenResponse {
  success: boolean;
  updatedToken: {
    mintAddress: string;
    isMintable: boolean;
    isFrozen: boolean;
    updatedAt: Date;
  };
}

export interface GetTokenStatsRequest {
  mintAddress: string;
}

export interface TokenStats {
  mintAddress: string;
  name: string;
  symbol: string;
  totalSupply: string;
  totalMinted: string;
  remainingSupply: string;
  percentageMinted: number;
  uniqueHolders: number;
  totalMints: number;
  isMintable: boolean;
  isFrozen: boolean;
  createdAt: Date;
}

export interface MintHistory {
  id: number;
  recipientAddress: string;
  amount: string;
  mintedBy: string;
  transactionSignature: string;
  createdAt: Date;
}

export interface GetMintHistoryRequest {
  mintAddress: string;
  limit?: number;
  offset?: number;
}

export interface GetMintHistoryResponse {
  mints: MintHistory[];
  total: number;
  hasMore: boolean;
}

// Updates token management settings
export const updateToken = api<UpdateTokenRequest, UpdateTokenResponse>(
  { expose: true, method: "PUT", path: "/token/:mintAddress/manage" },
  async (req) => {
    try {
      // Get token and verify ownership
      const token = await tokenDB.queryRow<{
        id: number;
        creatorWallet: string;
        isMintable: boolean;
        isFrozen: boolean;
      }>`
        SELECT id, creator_wallet as "creatorWallet", is_mintable as "isMintable", is_frozen as "isFrozen"
        FROM tokens
        WHERE mint_address = ${req.mintAddress}
      `;

      if (!token) {
        throw APIError.notFound("Token not found");
      }

      // Check if user has authority (only creator can manage)
      if (token.creatorWallet !== req.updaterWallet) {
        throw APIError.permissionDenied("Only the token creator can manage this token");
      }

      // Prepare update fields
      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (req.isMintable !== undefined) {
        updates.push(`is_mintable = $${paramIndex}`);
        values.push(req.isMintable);
        paramIndex++;
      }

      if (req.isFrozen !== undefined) {
        updates.push(`is_frozen = $${paramIndex}`);
        values.push(req.isFrozen);
        paramIndex++;
      }

      if (updates.length === 0) {
        throw APIError.invalidArgument("No valid updates provided");
      }

      updates.push(`updated_at = NOW()`);

      // Update token
      const query = `
        UPDATE tokens 
        SET ${updates.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING mint_address as "mintAddress", is_mintable as "isMintable", is_frozen as "isFrozen", updated_at as "updatedAt"
      `;
      values.push(token.id);

      const updatedToken = await tokenDB.rawQueryRow<{
        mintAddress: string;
        isMintable: boolean;
        isFrozen: boolean;
        updatedAt: Date;
      }>(query, ...values);

      if (!updatedToken) {
        throw APIError.internal("Failed to update token");
      }

      return {
        success: true,
        updatedToken
      };

    } catch (error) {
      console.error("Token update error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("An unexpected error occurred during token update");
    }
  }
);

// Gets comprehensive token statistics
export const getStats = api<GetTokenStatsRequest, TokenStats>(
  { expose: true, method: "GET", path: "/token/:mintAddress/stats" },
  async (req) => {
    const stats = await tokenDB.queryRow<TokenStats>`
      SELECT 
        t.mint_address as "mintAddress",
        t.name,
        t.symbol,
        t.supply as "totalSupply",
        t.total_minted as "totalMinted",
        (CAST(t.supply AS NUMERIC) - CAST(t.total_minted AS NUMERIC))::TEXT as "remainingSupply",
        CASE 
          WHEN CAST(t.supply AS NUMERIC) > 0 
          THEN (CAST(t.total_minted AS NUMERIC) / CAST(t.supply AS NUMERIC) * 100)::DOUBLE PRECISION
          ELSE 0 
        END as "percentageMinted",
        (SELECT COUNT(DISTINCT wallet_address) FROM token_balances WHERE token_id = t.id AND CAST(balance AS NUMERIC) > 0) as "uniqueHolders",
        (SELECT COUNT(*) FROM token_mints WHERE token_id = t.id) as "totalMints",
        t.is_mintable as "isMintable",
        t.is_frozen as "isFrozen",
        t.created_at as "createdAt"
      FROM tokens t
      WHERE t.mint_address = ${req.mintAddress}
    `;

    if (!stats) {
      throw APIError.notFound("Token not found");
    }

    return stats;
  }
);

// Gets mint history for a token
export const getMintHistory = api<GetMintHistoryRequest, GetMintHistoryResponse>(
  { expose: true, method: "GET", path: "/token/:mintAddress/mints" },
  async (req) => {
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    // First verify token exists
    const token = await tokenDB.queryRow<{ id: number }>`
      SELECT id FROM tokens WHERE mint_address = ${req.mintAddress}
    `;

    if (!token) {
      throw APIError.notFound("Token not found");
    }

    const [mints, countResult] = await Promise.all([
      tokenDB.rawQueryAll<MintHistory>(
        `SELECT id, recipient_address as "recipientAddress", amount, minted_by as "mintedBy", 
                transaction_signature as "transactionSignature", created_at as "createdAt"
         FROM token_mints 
         WHERE token_id = $1 
         ORDER BY created_at DESC 
         LIMIT $2 OFFSET $3`,
        token.id, limit, offset
      ),
      tokenDB.rawQueryRow<{ count: number }>(
        `SELECT COUNT(*) as count FROM token_mints WHERE token_id = $1`,
        token.id
      )
    ]);

    const total = countResult?.count || 0;
    const hasMore = offset + mints.length < total;

    return {
      mints,
      total,
      hasMore
    };
  }
);
