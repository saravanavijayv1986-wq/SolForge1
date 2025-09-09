import { Connection, Transaction, PublicKey } from '@solana/web3.js';

export interface SolanaError extends Error {
  code?: string;
  details?: any;
  txSignature?: string;
}

export class SolanaNetworkError extends Error implements SolanaError {
  code: string;
  details?: any;
  txSignature?: string;

  constructor(message: string, code: string, details?: any, txSignature?: string) {
    super(message);
    this.name = 'SolanaNetworkError';
    this.code = code;
    this.details = details;
    this.txSignature = txSignature;
  }
}

export const SOLANA_ERROR_CODES = {
  NETWORK_UNAVAILABLE: 'NETWORK_UNAVAILABLE',
  INSUFFICIENT_FUNDS: 'INSUFFICIENT_FUNDS',
  TRANSACTION_FAILED: 'TRANSACTION_FAILED',
  TIMEOUT: 'TIMEOUT',
  INVALID_ADDRESS: 'INVALID_ADDRESS',
  BLOCKHASH_EXPIRED: 'BLOCKHASH_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  ACCESS_FORBIDDEN: 'ACCESS_FORBIDDEN',
  UNKNOWN: 'UNKNOWN'
} as const;

export function parseSolanaError(error: any): SolanaNetworkError {
  const originalMessage = error?.message || 'Unknown Solana error';
  
  // Network connectivity issues
  if (originalMessage.includes('Network Error') || 
      originalMessage.includes('fetch') || 
      originalMessage.includes('timeout') ||
      originalMessage.includes('ECONNREFUSED')) {
    return new SolanaNetworkError(
      'Unable to connect to Solana network. Please check your internet connection and try again.',
      SOLANA_ERROR_CODES.NETWORK_UNAVAILABLE,
      { originalError: error }
    );
  }

  // Access forbidden (403 errors)
  if (originalMessage.includes('403') || 
      originalMessage.includes('Access forbidden') ||
      originalMessage.includes('Forbidden')) {
    return new SolanaNetworkError(
      'Access to Solana RPC endpoint denied. This may be due to rate limiting or API key requirements.',
      SOLANA_ERROR_CODES.ACCESS_FORBIDDEN,
      { originalError: error }
    );
  }

  // Insufficient funds
  if (originalMessage.includes('insufficient funds') || 
      originalMessage.includes('Attempt to debit an account but found no record')) {
    return new SolanaNetworkError(
      'Insufficient SOL balance to complete this transaction. Please add more SOL to your wallet.',
      SOLANA_ERROR_CODES.INSUFFICIENT_FUNDS,
      { originalError: error }
    );
  }

  // Transaction simulation failed
  if (originalMessage.includes('Transaction simulation failed') ||
      originalMessage.includes('custom program error')) {
    return new SolanaNetworkError(
      'Transaction validation failed. This might be due to network congestion or invalid parameters.',
      SOLANA_ERROR_CODES.TRANSACTION_FAILED,
      { originalError: error }
    );
  }

  // Blockhash expired
  if (originalMessage.includes('Blockhash not found') ||
      originalMessage.includes('This transaction has already been processed')) {
    return new SolanaNetworkError(
      'Transaction expired. Please try creating a new transaction.',
      SOLANA_ERROR_CODES.BLOCKHASH_EXPIRED,
      { originalError: error }
    );
  }

  // Rate limiting
  if (originalMessage.includes('429') || 
      originalMessage.includes('rate limit') ||
      originalMessage.includes('Too Many Requests')) {
    return new SolanaNetworkError(
      'Too many requests. Please wait a moment and try again.',
      SOLANA_ERROR_CODES.RATE_LIMITED,
      { originalError: error }
    );
  }

  // Invalid address format
  if (originalMessage.includes('Invalid public key') ||
      originalMessage.includes('Invalid base58 character')) {
    return new SolanaNetworkError(
      'Invalid Solana address format.',
      SOLANA_ERROR_CODES.INVALID_ADDRESS,
      { originalError: error }
    );
  }

  // Generic timeout
  if (originalMessage.includes('timeout') || originalMessage.includes('TIMEOUT')) {
    return new SolanaNetworkError(
      'Request timed out. Please try again.',
      SOLANA_ERROR_CODES.TIMEOUT,
      { originalError: error }
    );
  }

  // Default case
  return new SolanaNetworkError(
    `Solana transaction failed: ${originalMessage}`,
    SOLANA_ERROR_CODES.UNKNOWN,
    { originalError: error }
  );
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries: number = 3,
  delay: number = 1000
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      
      const solanaError = parseSolanaError(error);
      
      // Don't retry on certain error types
      if (solanaError.code === SOLANA_ERROR_CODES.INSUFFICIENT_FUNDS ||
          solanaError.code === SOLANA_ERROR_CODES.INVALID_ADDRESS ||
          solanaError.code === SOLANA_ERROR_CODES.ACCESS_FORBIDDEN) {
        throw solanaError;
      }
      
      if (attempt === maxRetries) {
        throw solanaError;
      }
      
      // Exponential backoff
      const backoffDelay = delay * Math.pow(2, attempt - 1);
      await new Promise(resolve => setTimeout(resolve, backoffDelay));
    }
  }
  
  throw parseSolanaError(lastError);
}

export async function confirmTransactionWithTimeout(
  connection: Connection,
  signature: string,
  timeout: number = 60000
): Promise<boolean> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const status = await connection.getSignatureStatus(signature);
      
      if (status?.value?.confirmationStatus === 'confirmed' || 
          status?.value?.confirmationStatus === 'finalized') {
        if (status.value.err) {
          throw new SolanaNetworkError(
            `Transaction failed: ${JSON.stringify(status.value.err)}`,
            SOLANA_ERROR_CODES.TRANSACTION_FAILED,
            { confirmationStatus: status.value },
            signature
          );
        }
        return true;
      }
      
      if (status?.value?.err) {
        throw new SolanaNetworkError(
          `Transaction failed: ${JSON.stringify(status.value.err)}`,
          SOLANA_ERROR_CODES.TRANSACTION_FAILED,
          { confirmationStatus: status.value },
          signature
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      if (error instanceof SolanaNetworkError) {
        throw error;
      }
      
      // Continue polling on network errors
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  throw new SolanaNetworkError(
    'Transaction confirmation timeout. The transaction may still be processing.',
    SOLANA_ERROR_CODES.TIMEOUT,
    { timeout },
    signature
  );
}

export function getExplorerUrl(signature: string, cluster: 'mainnet-beta' | 'devnet' = 'mainnet-beta'): string {
  const baseUrl = 'https://explorer.solana.com';
  const clusterParam = cluster === 'mainnet-beta' ? '' : `?cluster=${cluster}`;
  return `${baseUrl}/tx/${signature}${clusterParam}`;
}

export function formatSolanaError(error: SolanaNetworkError): {
  title: string;
  description: string;
  action?: string;
} {
  switch (error.code) {
    case SOLANA_ERROR_CODES.NETWORK_UNAVAILABLE:
      return {
        title: 'Network Error',
        description: error.message,
        action: 'Check your internet connection and try again.'
      };

    case SOLANA_ERROR_CODES.ACCESS_FORBIDDEN:
      return {
        title: 'RPC Access Denied',
        description: 'Unable to access Solana network due to rate limiting or restrictions.',
        action: 'Please try again in a few moments. The app will automatically retry with backup endpoints.'
      };
      
    case SOLANA_ERROR_CODES.INSUFFICIENT_FUNDS:
      return {
        title: 'Insufficient Funds',
        description: error.message,
        action: 'Add more SOL to your wallet and try again.'
      };
      
    case SOLANA_ERROR_CODES.TRANSACTION_FAILED:
      return {
        title: 'Transaction Failed',
        description: error.message,
        action: 'Please review your transaction details and try again.'
      };
      
    case SOLANA_ERROR_CODES.TIMEOUT:
      return {
        title: 'Request Timeout',
        description: error.message,
        action: 'The network may be congested. Please try again in a few moments.'
      };
      
    case SOLANA_ERROR_CODES.BLOCKHASH_EXPIRED:
      return {
        title: 'Transaction Expired',
        description: error.message,
        action: 'Create a new transaction and try again.'
      };
      
    case SOLANA_ERROR_CODES.RATE_LIMITED:
      return {
        title: 'Rate Limited',
        description: error.message,
        action: 'Please wait a moment before trying again.'
      };
      
    case SOLANA_ERROR_CODES.INVALID_ADDRESS:
      return {
        title: 'Invalid Address',
        description: error.message,
        action: 'Please check the wallet address format.'
      };
      
    default:
      return {
        title: 'Transaction Error',
        description: error.message,
        action: 'Please try again or contact support if the issue persists.'
      };
  }
}
