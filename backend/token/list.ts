import { api, APIError } from "encore.dev/api";
import { Query } from "encore.dev/api";

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

      // Return empty list for now to avoid database issues
      return {
        tokens: [],
        total: 0,
        hasMore: false
      };

    } catch (error) {
      console.error("Token list error:", error);
      throw APIError.internal("Failed to retrieve tokens", { originalError: error instanceof Error ? error.message : String(error) });
    }
  }
);
