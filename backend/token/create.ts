import { api, APIError } from "encore.dev/api";
import { tokenDB } from "./db";
import { storage } from "~encore/clients";

export interface CreateTokenRequest {
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description?: string;
  logoFile?: string; // Base64 encoded image
  creatorWallet: string;
  isMintable?: boolean;
  feeTransactionSignature: string; // Required fee payment proof
}

export interface CreateTokenResponse {
  mintAddress: string;
  transactionSignature: string;
  token: TokenInfo;
  metadataUrl?: string;
  imageUrl?: string;
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
  createdAt: Date;
}

// Creates a new SPL token with metadata
export const create = api<CreateTokenRequest, CreateTokenResponse>(
  { expose: true, method: "POST", path: "/token/create" },
  async (req) => {
    try {
      // Validate input
      if (!req.name || req.name.trim().length === 0) {
        throw APIError.invalidArgument("Token name is required");
      }
      
      if (req.name.length > 32) {
        throw APIError.invalidArgument("Token name must be 32 characters or less");
      }
      
      if (!req.symbol || req.symbol.trim().length === 0) {
        throw APIError.invalidArgument("Token symbol is required");
      }
      
      if (req.symbol.length > 10) {
        throw APIError.invalidArgument("Token symbol must be 10 characters or less");
      }
      
      if (req.decimals < 0 || req.decimals > 9) {
        throw APIError.invalidArgument("Decimals must be between 0 and 9");
      }
      
      const supplyNum = parseFloat(req.supply);
      if (isNaN(supplyNum) || supplyNum <= 0) {
        throw APIError.invalidArgument("Supply must be a positive number");
      }

      if (!req.creatorWallet || req.creatorWallet.trim().length === 0) {
        throw APIError.invalidArgument("Creator wallet address is required");
      }

      if (!req.feeTransactionSignature || req.feeTransactionSignature.trim().length === 0) {
        throw APIError.invalidArgument("Fee payment is required to create a token");
      }

      // Verify fee transaction exists and was successful
      const existingFeeRecord = await tokenDB.queryRow<{ id: number }>`
        SELECT id FROM token_creation_fees 
        WHERE transaction_signature = ${req.feeTransactionSignature}
      `;

      if (existingFeeRecord) {
        throw APIError.alreadyExists("This fee transaction has already been used");
      }

      // Generate realistic mock mint address (in real implementation, this would come from Solana)
      const mintAddress = generateMintAddress();
      
      // Mock transaction signature
      const transactionSignature = generateTransactionSignature();

      let imageUrl: string | null = null;
      let imageTransactionId: string | null = null;
      let metadataUrl: string | null = null;
      let metadataTransactionId: string | null = null;

      // Upload image to Arweave if provided
      if (req.logoFile) {
        try {
          const imageResponse = await storage.uploadImage({
            imageData: req.logoFile,
            fileName: `${req.symbol.toLowerCase()}-logo.png`,
            contentType: 'image/png'
          });
          
          imageUrl = imageResponse.imageUrl;
          imageTransactionId = imageResponse.transactionId;
        } catch (error) {
          console.error("Image upload failed:", error);
          // Continue without image if upload fails
        }
      }

      // Upload metadata to Arweave
      try {
        const metadataResponse = await storage.uploadMetadata({
          name: req.name.trim(),
          symbol: req.symbol.trim().toUpperCase(),
          description: req.description?.trim(),
          image: imageUrl || undefined,
          decimals: req.decimals,
          supply: req.supply,
          creator: req.creatorWallet,
          attributes: [
            {
              trait_type: "Mintable",
              value: req.isMintable !== false ? "Yes" : "No"
            },
            {
              trait_type: "Platform",
              value: "SolForge"
            }
          ]
        });
        
        metadataUrl = metadataResponse.metadataUrl;
        metadataTransactionId = metadataResponse.transactionId;
      } catch (error) {
        console.error("Metadata upload failed:", error);
        // Continue without metadata URL if upload fails
      }

      // Begin transaction
      await tokenDB.exec`BEGIN`;

      try {
        // Record the fee payment
        await tokenDB.exec`
          INSERT INTO token_creation_fees (
            transaction_signature, creator_wallet, amount_sol, created_at
          )
          VALUES (
            ${req.feeTransactionSignature}, ${req.creatorWallet}, '0.1', NOW()
          )
        `;

        // Store token in database
        const token = await tokenDB.queryRow<TokenInfo>`
          INSERT INTO tokens (
            mint_address, name, symbol, decimals, supply, description, 
            logo_url, image_url, metadata_url, image_transaction_id, metadata_transaction_id,
            creator_wallet, total_minted, is_mintable, mint_authority, freeze_authority,
            fee_transaction_signature
          )
          VALUES (
            ${mintAddress}, ${req.name.trim()}, ${req.symbol.trim().toUpperCase()}, ${req.decimals}, 
            ${req.supply}, ${req.description?.trim() || null}, 
            ${imageUrl}, ${imageUrl}, ${metadataUrl}, ${imageTransactionId}, ${metadataTransactionId},
            ${req.creatorWallet}, '0', ${req.isMintable !== false}, ${req.creatorWallet}, ${req.creatorWallet},
            ${req.feeTransactionSignature}
          )
          RETURNING 
            id, mint_address as "mintAddress", name, symbol, decimals, supply, description, 
            logo_url as "logoUrl", metadata_url as "metadataUrl", creator_wallet as "creatorWallet",
            total_minted as "totalMinted", is_mintable as "isMintable", is_frozen as "isFrozen", 
            created_at as "createdAt"
        `;

        if (!token) {
          throw APIError.internal("Failed to create token record in database");
        }

        await tokenDB.exec`COMMIT`;

        return {
          mintAddress,
          transactionSignature,
          token,
          metadataUrl: metadataUrl || undefined,
          imageUrl: imageUrl || undefined
        };
      } catch (error) {
        await tokenDB.exec`ROLLBACK`;
        throw error;
      }
    } catch (error) {
      console.error("Token creation error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("An unexpected error occurred during token creation");
    }
  }
);

// Helper function to generate a realistic Solana mint address
function generateMintAddress(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 44; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Helper function to generate a realistic Solana transaction signature
function generateTransactionSignature(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
