import { api, APIError } from "encore.dev/api";
import { tokenDB } from "./db";
import { validateInput } from "../shared/validation";
import { createLogger } from "../shared/logger";
import { metrics, trackDbPerformance } from "../shared/monitoring";
import { TOKEN_CONFIG } from "../config/app";

const logger = createLogger('token-create');

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
    const requestId = `token-create-${Date.now()}`;
    const timer = metrics.timer('token_create_request');
    
    logger.info('Token creation request received', {
      requestId,
      mintAddress: req.mintAddress,
      name: req.name,
      symbol: req.symbol,
      creatorWallet: req.creatorWallet,
    });
    
    try {
      // Validate input with comprehensive checks
      validateInput()
        .validateWalletAddress(req.mintAddress, true)
        .validateTokenName(req.name, true)
        .validateTokenSymbol(req.symbol, true)
        .validateDecimals(req.decimals, true)
        .validateSupply(req.supply, true)
        .validateWalletAddress(req.creatorWallet, true)
        .validateStringLength(req.description || '', 'description', 0, TOKEN_CONFIG.maxDescriptionLength, false)
        .validateUrl(req.logoUrl || '', 'logoUrl', false)
        .validateUrl(req.metadataUrl || '', 'metadataUrl', false)
        .validateTransactionSignature(req.feeTransactionSignature || '', false)
        .throwIfInvalid();
      
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
      };
      
      // Validate supply is a valid number
      const supplyNumber = parseFloat(cleanedData.supply);
      if (isNaN(supplyNumber) || supplyNumber <= 0) {
        throw APIError.invalidArgument("Supply must be a valid positive number");
      }
      
      if (supplyNumber > TOKEN_CONFIG.maxSupply) {
        throw APIError.invalidArgument(`Supply cannot exceed ${TOKEN_CONFIG.maxSupply}`);
      }
      
      logger.debug('Token data validated and cleaned', {
        requestId,
        cleanedData,
      });
      
      // Test database connection
      const dbTimer = trackDbPerformance('connection_test', 'tokens');
      try {
        await tokenDB.queryRow`SELECT 1 as test`;
        logger.debug('Database connection test successful', { requestId });
      } catch (dbError) {
        logger.error('Database connection test failed', { requestId }, dbError instanceof Error ? dbError : new Error(String(dbError)));
        throw APIError.unavailable("Database is currently unavailable");
      } finally {
        dbTimer();
      }
      
      // Check if token already exists
      const existsTimer = trackDbPerformance('select', 'tokens');
      const existingToken = await tokenDB.queryRow<{ id: number }>`
        SELECT id FROM tokens WHERE mint_address = ${cleanedData.mintAddress}
      `;
      existsTimer();
      
      if (existingToken) {
        logger.warn('Token already exists', {
          requestId,
          mintAddress: cleanedData.mintAddress,
          existingId: existingToken.id,
        });
        throw APIError.alreadyExists("Token with this mint address already exists");
      }
      
      // Create the token record
      logger.info('Creating token record in database', {
        requestId,
        mintAddress: cleanedData.mintAddress,
      });
      
      const insertTimer = trackDbPerformance('insert', 'tokens');
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
      insertTimer();
      
      if (!token) {
        logger.error('Token creation failed - no data returned', { requestId });
        throw APIError.internal("Failed to create token record - no data returned");
      }
      
      timer();
      metrics.increment('token_create_success');
      
      logger.info('Token created successfully', {
        requestId,
        tokenId: token.id,
        mintAddress: token.mintAddress,
        symbol: token.symbol,
      });
      
      return token;
      
    } catch (error) {
      timer();
      metrics.increment('token_create_error');
      
      logger.error('Token creation failed', {
        requestId,
        mintAddress: req.mintAddress,
        error: error instanceof Error ? error.message : 'Unknown error',
      }, error instanceof Error ? error : new Error(String(error)));
      
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
          logger.error('Database syntax error', { requestId }, error);
          throw APIError.invalidArgument("Invalid data format provided");
        }
        
        if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          throw APIError.unavailable("Database connection failed");
        }
        
        if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
          logger.error('Database table missing', { requestId }, error);
          throw APIError.internal("Database not properly initialized");
        }
        
        if (errorMessage.includes('check constraint')) {
          throw APIError.invalidArgument("Data validation failed - check your input values");
        }
      }
      
      throw APIError.internal("An unexpected error occurred during token creation");
    }
  }
);
