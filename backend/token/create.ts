import { api, APIError } from "encore.dev/api";
import { tokenDB } from "./db";

export interface CreateTokenRequest {
  mintAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description?: string;
  logoUrl?: string;
  metadataUrl?: string;
  creatorWallet: string;
  feeTransactionSignature?: string;
  imageTransactionId?: string;
  metadataTransactionId?: string;
}

export interface CreateTokenResponse {
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

// Creates a new token record in the database
export const create = api<CreateTokenRequest, CreateTokenResponse>(
  { expose: true, method: "POST", path: "/token/create" },
  async (req) => {
    try {
      // Validate required fields
      if (!req.mintAddress || req.mintAddress.trim().length === 0) {
        throw APIError.invalidArgument("Mint address is required");
      }
      
      if (!req.name || req.name.trim().length === 0) {
        throw APIError.invalidArgument("Token name is required");
      }
      
      if (!req.symbol || req.symbol.trim().length === 0) {
        throw APIError.invalidArgument("Token symbol is required");
      }
      
      if (req.decimals < 0 || req.decimals > 9) {
        throw APIError.invalidArgument("Decimals must be between 0 and 9");
      }
      
      if (!req.supply || req.supply.trim().length === 0) {
        throw APIError.invalidArgument("Supply is required");
      }
      
      if (!req.creatorWallet || req.creatorWallet.trim().length === 0) {
        throw APIError.invalidArgument("Creator wallet is required");
      }

      // Check if token already exists
      const existingToken = await tokenDB.queryRow<{ id: number }>`
        SELECT id FROM tokens WHERE mint_address = ${req.mintAddress}
      `;

      if (existingToken) {
        throw APIError.alreadyExists("Token with this mint address already exists");
      }

      // Create the token
      const token = await tokenDB.queryRow<CreateTokenResponse>`
        INSERT INTO tokens (
          mint_address, name, symbol, decimals, supply, description, 
          logo_url, metadata_url, creator_wallet, fee_transaction_signature,
          image_transaction_id, metadata_transaction_id, total_minted
        )
        VALUES (
          ${req.mintAddress}, ${req.name}, ${req.symbol}, ${req.decimals}::integer, 
          ${req.supply}::numeric, ${req.description || null}, ${req.logoUrl || null}, 
          ${req.metadataUrl || null}, ${req.creatorWallet}, ${req.feeTransactionSignature || null},
          ${req.imageTransactionId || null}, ${req.metadataTransactionId || null}, '0'::numeric
        )
        RETURNING 
          id, mint_address as "mintAddress", name, symbol, decimals, supply,
          description, logo_url as "logoUrl", metadata_url as "metadataUrl",
          creator_wallet as "creatorWallet", created_at as "createdAt"
      `;

      if (!token) {
        throw APIError.internal("Failed to create token");
      }

      return token;

    } catch (error) {
      console.error("Token creation error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle database constraint errors
      if (error instanceof Error && error.message.includes('unique constraint')) {
        throw APIError.alreadyExists("Token with this mint address already exists");
      }
      
      throw APIError.internal("An unexpected error occurred during token creation");
    }
  }
);
