import { api, APIError } from "encore.dev/api";
import { validateInput } from "../shared/validation";
import { createLogger } from "../shared/logger";
import { metrics } from "../shared/monitoring";
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
      
      // For development, return a mock successful response
      const mockToken: CreateTokenResponse = {
        id: Math.floor(Math.random() * 10000),
        mintAddress: cleanedData.mintAddress,
        name: cleanedData.name,
        symbol: cleanedData.symbol,
        decimals: cleanedData.decimals,
        supply: cleanedData.supply,
        description: cleanedData.description || undefined,
        logoUrl: cleanedData.logoUrl || undefined,
        metadataUrl: cleanedData.metadataUrl || undefined,
        creatorWallet: cleanedData.creatorWallet,
        createdAt: new Date(),
      };
      
      timer();
      metrics.increment('token_create_success');
      
      logger.info('Token created successfully (development mode)', {
        requestId,
        tokenId: mockToken.id,
        mintAddress: mockToken.mintAddress,
        symbol: mockToken.symbol,
      });
      
      return mockToken;
      
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
      
      throw APIError.internal("An unexpected error occurred during token creation");
    }
  }
);
