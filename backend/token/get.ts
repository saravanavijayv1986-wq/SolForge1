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
    try {
      // Validate input
      if (!req.mintAddress || req.mintAddress.trim().length === 0) {
        throw APIError.invalidArgument("Mint address is required");
      }

      // Test database connection
      try {
        await tokenDB.queryRow`SELECT 1 as test`;
      } catch (dbError) {
        console.error("Database connection test failed:", dbError);
        throw APIError.unavailable("Database is currently unavailable");
      }

      console.log("Getting token with mint address:", req.mintAddress);

      const token = await tokenDB.queryRow<TokenInfo>`
        SELECT 
          id, 
          mint_address as "mintAddress", 
          name, 
          symbol, 
          decimals, 
          supply, 
          description, 
          logo_url as "logoUrl", 
          metadata_url as "metadataUrl",
          creator_wallet as "creatorWallet", 
          created_at as "createdAt"
        FROM tokens
        WHERE mint_address = ${req.mintAddress.trim()}
      `;
      
      if (!token) {
        throw APIError.notFound("Token not found");
      }

      console.log("Token found:", token.id);
      return token;

    } catch (error) {
      console.error("Get token error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.message.includes('connection') || error.message.includes('timeout')) {
          throw APIError.unavailable("Database connection failed");
        }
        
        if (error.message.includes('syntax error')) {
          throw APIError.invalidArgument("Invalid mint address format");
        }
      }
      
      throw APIError.internal("Failed to retrieve token");
    }
  }
);
