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
      console.log("Token creation request received:", {
        mintAddress: req.mintAddress,
        name: req.name,
        symbol: req.symbol,
        decimals: req.decimals,
        creatorWallet: req.creatorWallet
      });

      // Validate required fields
      if (!req.mintAddress || typeof req.mintAddress !== 'string' || req.mintAddress.trim().length === 0) {
        throw APIError.invalidArgument("Mint address is required and must be a non-empty string");
      }
      
      if (!req.name || typeof req.name !== 'string' || req.name.trim().length === 0) {
        throw APIError.invalidArgument("Token name is required and must be a non-empty string");
      }
      
      if (!req.symbol || typeof req.symbol !== 'string' || req.symbol.trim().length === 0) {
        throw APIError.invalidArgument("Token symbol is required and must be a non-empty string");
      }
      
      if (typeof req.decimals !== 'number' || req.decimals < 0 || req.decimals > 9 || !Number.isInteger(req.decimals)) {
        throw APIError.invalidArgument("Decimals must be an integer between 0 and 9");
      }
      
      if (!req.supply || typeof req.supply !== 'string' || req.supply.trim().length === 0) {
        throw APIError.invalidArgument("Supply is required and must be a non-empty string");
      }
      
      if (!req.creatorWallet || typeof req.creatorWallet !== 'string' || req.creatorWallet.trim().length === 0) {
        throw APIError.invalidArgument("Creator wallet is required and must be a non-empty string");
      }

      // Validate supply is a valid number
      const supplyNumber = parseFloat(req.supply.trim());
      if (isNaN(supplyNumber) || supplyNumber < 0) {
        throw APIError.invalidArgument("Supply must be a valid positive number");
      }

      // Clean and prepare data
      const cleanedData = {
        mintAddress: req.mintAddress.trim(),
        name: req.name.trim(),
        symbol: req.symbol.trim().toUpperCase(),
        decimals: req.decimals,
        supply: req.supply.trim(),
        description: req.description?.trim() || null,
        logoUrl: req.logoUrl?.trim() || null,
        metadataUrl: req.metadataUrl?.trim() || null,
        creatorWallet: req.creatorWallet.trim(),
        feeTransactionSignature: req.feeTransactionSignature?.trim() || null,
        imageTransactionId: req.imageTransactionId?.trim() || null,
        metadataTransactionId: req.metadataTransactionId?.trim() || null
      };

      console.log("Cleaned token data:", cleanedData);

      // Test database connection first
      try {
        await tokenDB.queryRow`SELECT 1 as test`;
        console.log("Database connection test successful");
      } catch (dbError) {
        console.error("Database connection test failed:", dbError);
        throw APIError.unavailable("Database is currently unavailable");
      }

      // Check if token already exists
      const existingToken = await tokenDB.queryRow<{ id: number }>`
        SELECT id FROM tokens WHERE mint_address = ${cleanedData.mintAddress}
      `;

      if (existingToken) {
        console.log("Token already exists with mint address:", cleanedData.mintAddress);
        throw APIError.alreadyExists("Token with this mint address already exists");
      }

      // Create the token with explicit column mapping
      console.log("Inserting token into database...");
      const token = await tokenDB.queryRow<CreateTokenResponse>`
        INSERT INTO tokens (
          mint_address,
          name,
          symbol,
          decimals,
          supply,
          description,
          logo_url,
          metadata_url,
          creator_wallet,
          fee_transaction_signature,
          image_transaction_id,
          metadata_transaction_id,
          total_minted,
          is_mintable,
          is_frozen
        )
        VALUES (
          ${cleanedData.mintAddress},
          ${cleanedData.name},
          ${cleanedData.symbol},
          ${cleanedData.decimals},
          ${cleanedData.supply}::numeric,
          ${cleanedData.description},
          ${cleanedData.logoUrl},
          ${cleanedData.metadataUrl},
          ${cleanedData.creatorWallet},
          ${cleanedData.feeTransactionSignature},
          ${cleanedData.imageTransactionId},
          ${cleanedData.metadataTransactionId},
          '0'::numeric,
          true,
          false
        )
        RETURNING 
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
      `;

      if (!token) {
        throw APIError.internal("Failed to create token record - no data returned");
      }

      console.log("Token created successfully with ID:", token.id);
      return token;

    } catch (error) {
      console.error("Token creation error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle specific database errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
          throw APIError.alreadyExists("Token with this mint address already exists");
        }
        
        if (errorMessage.includes('invalid input syntax') || errorMessage.includes('invalid type')) {
          console.error("Database syntax error:", error.message);
          throw APIError.invalidArgument("Invalid data format provided");
        }
        
        if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          throw APIError.unavailable("Database connection failed");
        }
        
        if (errorMessage.includes('column') && errorMessage.includes('does not exist')) {
          console.error("Database schema error - missing column:", error.message);
          throw APIError.internal("Database schema error. Please contact support.");
        }

        if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
          console.error("Database table missing:", error.message);
          throw APIError.internal("Database not properly initialized. Please contact support.");
        }

        if (errorMessage.includes('check constraint')) {
          throw APIError.invalidArgument("Data validation failed - check your input values");
        }
      }
      
      throw APIError.internal("An unexpected error occurred during token creation");
    }
  }
);
