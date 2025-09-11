import { Connection, PublicKey, Transaction, Commitment, ConfirmOptions } from "@solana/web3.js";
import { SOLANA_CONFIG, SECRETS } from "../config/app";
import { createLogger } from "./logger";
import { metrics, trackDbPerformance } from "./monitoring";

const logger = createLogger('solana');

export interface SolanaConnectionConfig {
  endpoint: string;
  commitment?: Commitment;
  timeout?: number;
  maxRetries?: number;
  retryDelay?: number;
}

export interface TransactionResult {
  signature: string;
  confirmed: boolean;
  slot?: number;
  confirmationStatus?: string;
  error?: any;
}

export class SolanaService {
  private connection: Connection;
  private config: SolanaConnectionConfig;
  private backupEndpoints: string[] = [];

  constructor(config?: Partial<SolanaConnectionConfig>) {
    this.config = {
      endpoint: SECRETS.solanaRpcUrl(),
      commitment: SOLANA_CONFIG.commitment,
      timeout: SOLANA_CONFIG.rpcTimeout,
      maxRetries: SOLANA_CONFIG.maxRetries,
      retryDelay: SOLANA_CONFIG.retryDelay,
      ...config,
    };

    this.connection = new Connection(this.config.endpoint, {
      commitment: this.config.commitment,
      confirmTransactionInitialTimeout: this.config.timeout,
    });

    // Setup backup endpoints for devnet
    this.backupEndpoints = [
      "https://api.devnet.solana.com",
      "https://devnet.genesysgo.net",
      "https://rpc.ankr.com/solana_devnet",
    ];

    logger.info('Solana service initialized', {
      network: SOLANA_CONFIG.network,
      endpoint: this.config.endpoint,
      commitment: this.config.commitment,
    });
  }

  // Get connection instance
  getConnection(): Connection {
    return this.connection;
  }

  // Health check
  async checkHealth(): Promise<{ healthy: boolean; latency: number; slot?: number; error?: string }> {
    const startTime = Date.now();
    const timer = metrics.timer('solana_health_check');
    
    try {
      const slot = await this.withRetry(async () => {
        return await this.connection.getSlot(this.config.commitment);
      });
      
      const latency = Date.now() - startTime;
      timer();
      
      logger.debug('Solana health check successful', {
        latency: `${latency}ms`,
        slot,
        network: SOLANA_CONFIG.network,
      });
      
      return {
        healthy: true,
        latency,
        slot,
      };
    } catch (error) {
      timer();
      const latency = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      logger.error('Solana health check failed', {
        latency: `${latency}ms`,
        network: SOLANA_CONFIG.network,
      }, error instanceof Error ? error : new Error(errorMessage));
      
      return {
        healthy: false,
        latency,
        error: errorMessage,
      };
    }
  }

  // Get balance with retry logic
  async getBalance(publicKey: PublicKey): Promise<number> {
    const timer = metrics.timer('solana_get_balance');
    
    try {
      const balance = await this.withRetry(async () => {
        return await this.connection.getBalance(publicKey, this.config.commitment);
      });
      
      timer();
      metrics.increment('solana_get_balance_success');
      
      logger.debug('Retrieved wallet balance', {
        publicKey: publicKey.toString(),
        balance,
        balanceSOL: (balance / 1e9).toFixed(4),
      });
      
      return balance;
    } catch (error) {
      timer();
      metrics.increment('solana_get_balance_error');
      
      logger.error('Failed to get balance', {
        publicKey: publicKey.toString(),
      }, error instanceof Error ? error : new Error(String(error)));
      
      throw this.handleSolanaError(error, 'Failed to retrieve wallet balance');
    }
  }

  // Get transaction with retry logic
  async getTransaction(signature: string): Promise<any> {
    const timer = metrics.timer('solana_get_transaction');
    
    try {
      const transaction = await this.withRetry(async () => {
        return await this.connection.getTransaction(signature, {
          commitment: this.config.commitment,
          maxSupportedTransactionVersion: 0,
        });
      });
      
      timer();
      metrics.increment('solana_get_transaction_success');
      
      logger.debug('Retrieved transaction', {
        signature,
        found: !!transaction,
        slot: transaction?.slot,
      });
      
      return transaction;
    } catch (error) {
      timer();
      metrics.increment('solana_get_transaction_error');
      
      logger.error('Failed to get transaction', {
        signature,
      }, error instanceof Error ? error : new Error(String(error)));
      
      throw this.handleSolanaError(error, 'Failed to retrieve transaction');
    }
  }

  // Confirm transaction with timeout
  async confirmTransaction(signature: string, timeout?: number): Promise<TransactionResult> {
    const timer = metrics.timer('solana_confirm_transaction');
    const confirmTimeout = timeout || SOLANA_CONFIG.confirmationTimeout;
    
    try {
      const startTime = Date.now();
      
      // Get latest blockhash for confirmation
      const { blockhash, lastValidBlockHeight } = await this.connection.getLatestBlockhash(this.config.commitment);
      
      const confirmation = await Promise.race([
        this.connection.confirmTransaction({
          signature,
          blockhash,
          lastValidBlockHeight,
        }, this.config.commitment),
        new Promise<never>((_, reject) => 
          setTimeout(() => reject(new Error('Transaction confirmation timeout')), confirmTimeout)
        ),
      ]);
      
      const confirmationTime = Date.now() - startTime;
      timer();
      
      if (confirmation.value.err) {
        metrics.increment('solana_confirm_transaction_failed');
        
        logger.warn('Transaction confirmation failed', {
          signature,
          error: confirmation.value.err,
          confirmationTime: `${confirmationTime}ms`,
        });
        
        return {
          signature,
          confirmed: false,
          error: confirmation.value.err,
        };
      }
      
      metrics.increment('solana_confirm_transaction_success');
      
      // Get final transaction status
      const finalStatus = await this.connection.getSignatureStatus(signature);
      
      logger.info('Transaction confirmed successfully', {
        signature,
        confirmationTime: `${confirmationTime}ms`,
        slot: finalStatus?.value?.slot,
        confirmationStatus: finalStatus?.value?.confirmationStatus,
      });
      
      return {
        signature,
        confirmed: true,
        slot: finalStatus?.value?.slot,
        confirmationStatus: finalStatus?.value?.confirmationStatus || 'confirmed',
      };
    } catch (error) {
      timer();
      metrics.increment('solana_confirm_transaction_error');
      
      logger.error('Transaction confirmation error', {
        signature,
        timeout: `${confirmTimeout}ms`,
      }, error instanceof Error ? error : new Error(String(error)));
      
      return {
        signature,
        confirmed: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  // Send transaction with retry logic
  async sendTransaction(transaction: Transaction, options?: ConfirmOptions): Promise<string> {
    const timer = metrics.timer('solana_send_transaction');
    
    try {
      const signature = await this.withRetry(async () => {
        return await this.connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: this.config.commitment,
          maxRetries: 1, // We handle retries at a higher level
          ...options,
        });
      });
      
      timer();
      metrics.increment('solana_send_transaction_success');
      
      logger.info('Transaction sent successfully', {
        signature,
        transactionSize: transaction.serialize().length,
      });
      
      return signature;
    } catch (error) {
      timer();
      metrics.increment('solana_send_transaction_error');
      
      logger.error('Failed to send transaction', {
        transactionSize: transaction.serialize().length,
      }, error instanceof Error ? error : new Error(String(error)));
      
      throw this.handleSolanaError(error, 'Failed to send transaction');
    }
  }

  // Get account info with retry logic
  async getAccountInfo(publicKey: PublicKey): Promise<any> {
    const timer = metrics.timer('solana_get_account_info');
    
    try {
      const accountInfo = await this.withRetry(async () => {
        return await this.connection.getAccountInfo(publicKey, this.config.commitment);
      });
      
      timer();
      metrics.increment('solana_get_account_info_success');
      
      logger.debug('Retrieved account info', {
        publicKey: publicKey.toString(),
        exists: !!accountInfo,
        lamports: accountInfo?.lamports,
      });
      
      return accountInfo;
    } catch (error) {
      timer();
      metrics.increment('solana_get_account_info_error');
      
      logger.error('Failed to get account info', {
        publicKey: publicKey.toString(),
      }, error instanceof Error ? error : new Error(String(error)));
      
      throw this.handleSolanaError(error, 'Failed to retrieve account information');
    }
  }

  // Validate public key
  validatePublicKey(address: string): boolean {
    try {
      new PublicKey(address);
      return true;
    } catch {
      return false;
    }
  }

  // Get current slot
  async getCurrentSlot(): Promise<number> {
    const timer = metrics.timer('solana_get_current_slot');
    
    try {
      const slot = await this.withRetry(async () => {
        return await this.connection.getSlot(this.config.commitment);
      });
      
      timer();
      return slot;
    } catch (error) {
      timer();
      throw this.handleSolanaError(error, 'Failed to get current slot');
    }
  }

  // Generic retry wrapper
  private async withRetry<T>(operation: () => Promise<T>): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.config.maxRetries!; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        
        logger.warn(`Solana operation attempt ${attempt} failed`, {
          attempt,
          maxRetries: this.config.maxRetries,
          error: lastError.message,
        });
        
        // Don't retry on certain errors
        if (this.shouldNotRetry(lastError)) {
          throw lastError;
        }
        
        if (attempt === this.config.maxRetries) {
          throw lastError;
        }
        
        // Exponential backoff
        const delay = this.config.retryDelay! * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw lastError!;
  }

  // Check if error should not be retried
  private shouldNotRetry(error: Error): boolean {
    const message = error.message.toLowerCase();
    
    // Don't retry on client errors
    if (message.includes('invalid') || 
        message.includes('insufficient funds') ||
        message.includes('account not found') ||
        message.includes('blockhash not found')) {
      return true;
    }
    
    return false;
  }

  // Handle and format Solana errors
  private handleSolanaError(error: any, context: string): Error {
    const originalMessage = error?.message || 'Unknown Solana error';
    let userMessage = context;
    
    // Network errors
    if (originalMessage.includes('Network Error') || 
        originalMessage.includes('fetch') || 
        originalMessage.includes('timeout')) {
      userMessage = 'Network connection error. Please check your internet connection and try again.';
    }
    
    // Rate limiting
    else if (originalMessage.includes('429') || 
             originalMessage.includes('rate limit')) {
      userMessage = 'Too many requests. Please wait a moment and try again.';
    }
    
    // Insufficient funds
    else if (originalMessage.includes('insufficient funds')) {
      userMessage = 'Insufficient SOL balance for this transaction.';
    }
    
    // Transaction errors
    else if (originalMessage.includes('Transaction simulation failed')) {
      userMessage = 'Transaction validation failed. Please check your input parameters.';
    }
    
    // Blockhash errors
    else if (originalMessage.includes('Blockhash not found')) {
      userMessage = 'Transaction expired. Please try again.';
    }
    
    const enhancedError = new Error(userMessage);
    enhancedError.stack = error?.stack;
    
    return enhancedError;
  }

  // Connection switching for better reliability
  async switchToBackupEndpoint(): Promise<boolean> {
    for (const endpoint of this.backupEndpoints) {
      try {
        const testConnection = new Connection(endpoint, {
          commitment: this.config.commitment,
          confirmTransactionInitialTimeout: this.config.timeout,
        });
        
        // Test the connection
        await testConnection.getSlot();
        
        // Switch to this endpoint
        this.connection = testConnection;
        this.config.endpoint = endpoint;
        
        logger.info('Switched to backup Solana endpoint', {
          endpoint,
          network: SOLANA_CONFIG.network,
        });
        
        return true;
      } catch (error) {
        logger.warn('Backup endpoint failed', {
          endpoint,
        }, error instanceof Error ? error : new Error(String(error)));
      }
    }
    
    logger.error('All backup endpoints failed');
    return false;
  }
}

// Global Solana service instance
export const solanaService = new SolanaService();

// Utility functions
export const validateSolanaAddress = (address: string): boolean => {
  return solanaService.validatePublicKey(address);
};

export const createPublicKey = (address: string): PublicKey => {
  try {
    return new PublicKey(address);
  } catch (error) {
    throw new Error(`Invalid Solana address: ${address}`);
  }
};

export const formatSolBalance = (lamports: number): string => {
  return (lamports / 1e9).toFixed(4);
};

export const parseSolAmount = (solAmount: string): number => {
  const amount = parseFloat(solAmount);
  if (isNaN(amount) || amount < 0) {
    throw new Error('Invalid SOL amount');
  }
  return Math.floor(amount * 1e9); // Convert to lamports
};

// Network information
export const getNetworkInfo = () => ({
  network: SOLANA_CONFIG.network,
  endpoint: solanaService.getConnection().rpcEndpoint,
  commitment: SOLANA_CONFIG.commitment,
});
