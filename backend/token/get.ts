import { api, APIError } from "encore.dev/api";
import { tokenDB } from "./db";

export interface GetTokenRequest {
  mintAddress: string;
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
  createdAt: Date;
}

// Gets a specific token by mint address
export const get = api<GetTokenRequest, TokenInfo>(
  { expose: true, method: "GET", path: "/token/:mintAddress" },
  async (req) => {
    const token = await tokenDB.queryRow<TokenInfo>`
      SELECT id, mint_address as "mintAddress", name, symbol, decimals, supply, 
             description, logo_url as "logoUrl", metadata_url as "metadataUrl",
             creator_wallet as "creatorWallet", created_at as "createdAt"
      FROM tokens
      WHERE mint_address = ${req.mintAddress}
    `;
    
    if (!token) {
      throw APIError.notFound("Token not found");
    }
    
    return token;
  }
);
