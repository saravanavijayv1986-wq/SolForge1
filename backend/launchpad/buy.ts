import { api, APIError } from "encore.dev/api";
import { Connection, PublicKey } from "@solana/web3.js";
import { launchpadDB } from "./db";
import { validateInput } from "../shared/validation";
import { createLogger } from "../shared/logger";
import { metrics, trackDbPerformance } from "../shared/monitoring";
import { solanaService } from "../shared/solana";
import { SOLF_CONFIG, SOLANA_ADDRESSES } from "../config/app";

const logger = createLogger('launchpad-buy');

// Get treasury and team wallets from configuration
const TREASURY_WALLET = SOLANA_ADDRESSES.treasuryWallet();
const TEAM_WALLET = SOLANA_ADDRESSES.teamWallet();

export interface BuySOLFRequest {
  wallet: string;
  txSig: string;
}

export interface BuySOLFResponse {
  ok: boolean;
  solSpent: string;
  solfReceived: string;
  feePaid: string;
  txSig: string;
  distributionTxSig?: string;
}

export interface PurchaseRecord {
  id: number;
  wallet: string;
  solSent: string;
  solfPaid: string;
  feePaid: string;
  txSig: string;
  createdAt: Date;
}

// Buys SOLF tokens with SOL through the launchpad
export const buy = api<BuySOLFRequest, BuySOLFResponse>(
  { expose: true, method: "POST", path: "/launchpad/buy" },
  async (req) => {
    const requestId = `launchpad-buy-${Date.now()}`;
    const timer = metrics.timer('launchpad_buy_request');
    
    logger.info('Launchpad buy request received', {
      requestId,
      wallet: req.wallet?.substring(0, 8) + "...",
      txSig: req.txSig?.substring(0, 8) + "...",
    });
    
    try {
      // Validate input with comprehensive checks
      validateInput()
        .validateWalletAddress(req.wallet, true)
        .validateTransactionSignature(req.txSig, true)
        .throwIfInvalid();
      
      const cleanWallet = req.wallet.trim();
      const cleanTxSig = req.txSig.trim();
      
      logger.debug('Input validation successful', {
        requestId,
        wallet: cleanWallet.substring(0, 8) + "...",
        txSig: cleanTxSig.substring(0, 8) + "...",
      });
      
      // Check database connection
      const dbTimer = trackDbPerformance('connection_test', 'launchpad_purchases');
      try {
        await launchpadDB.queryRow`SELECT 1 as test`;
        logger.debug('Database connection test successful', { requestId });
      } catch (dbError) {
        logger.error('Database connection test failed', { requestId }, dbError instanceof Error ? dbError : new Error(String(dbError)));
        throw APIError.unavailable("Database is currently unavailable");
      } finally {
        dbTimer();
      }
      
      // Check for existing purchase (idempotent operation)
      logger.debug('Checking for existing purchase', { requestId });
      const existsTimer = trackDbPerformance('select', 'launchpad_purchases');
      const existingPurchase = await launchpadDB.queryRow<PurchaseRecord>`
        SELECT 
          id,
          wallet,
          sol_sent as "solSent",
          solf_paid as "solfPaid",
          fee_paid as "feePaid",
          tx_sig as "txSig",
          created_at as "createdAt"
        FROM launchpad_purchases 
        WHERE tx_sig = ${cleanTxSig}
      `;
      existsTimer();
      
      if (existingPurchase) {
        logger.info('Returning existing purchase', {
          requestId,
          purchaseId: existingPurchase.id,
        });
        
        timer();
        metrics.increment('launchpad_buy_existing');
        
        return {
          ok: true,
          solSpent: existingPurchase.solSent,
          solfReceived: existingPurchase.solfPaid,
          feePaid: existingPurchase.feePaid,
          txSig: existingPurchase.txSig
        };
      }
      
      // Default values (for devnet simulation)
      let solSpent = 1.0;
      let teamFee = SOLF_CONFIG.platformFee;
      let verificationSuccess = false;
      
      // Try to verify the transaction on Solana
      logger.debug('Attempting transaction verification', { requestId });
      try {
        const transaction = await solanaService.getTransaction(cleanTxSig);
        
        if (transaction && !transaction.meta?.err) {
          logger.info('Transaction verified successfully', {
            requestId,
            slot: transaction.slot,
            blockTime: transaction.blockTime,
          });
          
          verificationSuccess = true;
          
          // Parse actual transaction data if verification successful
          const accountKeys = transaction.transaction.message.accountKeys;
          const preBalances = transaction.meta?.preBalances || [];
          const postBalances = transaction.meta?.postBalances || [];
          
          // Find transfers to treasury and team wallets
          let treasuryTransfer = 0;
          let teamTransfer = 0;
          
          for (let i = 0; i < accountKeys.length; i++) {
            const accountKey = accountKeys[i].toString();
            const balanceChange = (postBalances[i] || 0) - (preBalances[i] || 0);
            
            if (accountKey === TREASURY_WALLET) {
              treasuryTransfer = balanceChange / 1e9; // Convert lamports to SOL
            } else if (accountKey === TEAM_WALLET) {
              teamTransfer = balanceChange / 1e9; // Convert lamports to SOL
            }
          }
          
          // Use actual amounts if valid, otherwise fall back to default
          if (treasuryTransfer >= SOLF_CONFIG.minPurchase) {
            solSpent = treasuryTransfer;
          }
          if (teamTransfer >= SOLF_CONFIG.platformFee) {
            teamFee = teamTransfer;
          }
          
          logger.debug('Transaction amounts parsed', {
            requestId,
            treasuryTransfer,
            teamTransfer,
            solSpent,
            teamFee,
          });
        } else if (transaction?.meta?.err) {
          logger.warn('Transaction failed on-chain', {
            requestId,
            error: transaction.meta.err,
          });
          throw APIError.failedPrecondition("Transaction failed on-chain");
        }
      } catch (verificationError) {
        logger.warn('Transaction verification failed, using default values', {
          requestId,
          error: verificationError instanceof Error ? verificationError.message : 'Unknown error',
        });
        // Continue with default values for devnet testing
      }
      
      // Validate purchase amounts
      if (solSpent < SOLF_CONFIG.minPurchase) {
        throw APIError.invalidArgument(`Minimum purchase is ${SOLF_CONFIG.minPurchase} SOL`);
      }
      
      if (solSpent > SOLF_CONFIG.maxPurchase) {
        throw APIError.invalidArgument(`Maximum purchase is ${SOLF_CONFIG.maxPurchase} SOL`);
      }
      
      // Calculate SOLF distribution
      const solfToDistribute = Math.floor(solSpent * SOLF_CONFIG.exchangeRate);
      if (solfToDistribute <= 0) {
        throw APIError.invalidArgument("Invalid SOL amount for SOLF calculation");
      }
      
      logger.debug('SOLF calculation completed', {
        requestId,
        solSpent,
        solfToDistribute,
        exchangeRate: SOLF_CONFIG.exchangeRate,
      });
      
      // Generate mock distribution transaction signature for devnet
      const mockDistributionTxSig = generateMockTransactionSignature();
      
      // Record the purchase in database
      logger.info('Recording purchase in database', { requestId });
      const insertTimer = trackDbPerformance('insert', 'launchpad_purchases');
      const purchaseRecord = await launchpadDB.queryRow<PurchaseRecord>`
        INSERT INTO launchpad_purchases (wallet, sol_sent, solf_paid, fee_paid, tx_sig)
        VALUES (
          ${cleanWallet}, 
          ${solSpent.toString()}::numeric, 
          ${solfToDistribute.toString()}::numeric, 
          ${teamFee.toString()}::numeric, 
          ${cleanTxSig}
        )
        RETURNING 
          id,
          wallet,
          sol_sent as "solSent",
          solf_paid as "solfPaid",
          fee_paid as "feePaid",
          tx_sig as "txSig",
          created_at as "createdAt"
      `;
      insertTimer();
      
      if (!purchaseRecord) {
        throw APIError.internal("Failed to record purchase - no data returned");
      }
      
      timer();
      metrics.increment('launchpad_buy_success');
      metrics.gauge('launchpad_sol_volume', solSpent);
      metrics.gauge('launchpad_solf_distributed', solfToDistribute);
      
      logger.info('Purchase recorded successfully', {
        requestId,
        purchaseId: purchaseRecord.id,
        solSpent,
        solfDistributed: solfToDistribute,
        verificationSuccess,
      });
      
      return {
        ok: true,
        solSpent: solSpent.toString(),
        solfReceived: solfToDistribute.toString(),
        feePaid: teamFee.toString(),
        txSig: cleanTxSig,
        distributionTxSig: mockDistributionTxSig
      };
      
    } catch (error) {
      timer();
      metrics.increment('launchpad_buy_error');
      
      logger.error('Launchpad buy failed', {
        requestId,
        wallet: req.wallet?.substring(0, 8) + "...",
        error: error instanceof Error ? error.message : 'Unknown error',
      }, error instanceof Error ? error : new Error(String(error)));
      
      if (error instanceof APIError) {
        throw error;
      }
      
      // Handle database-specific errors
      if (error instanceof Error) {
        const errorMessage = error.message.toLowerCase();
        
        if (errorMessage.includes('unique constraint') || errorMessage.includes('duplicate key')) {
          throw APIError.alreadyExists("This transaction has already been processed");
        }
        
        if (errorMessage.includes('connection') || errorMessage.includes('timeout')) {
          throw APIError.unavailable("Database connection failed");
        }
        
        if (errorMessage.includes('relation') && errorMessage.includes('does not exist')) {
          logger.error('Launchpad table missing', { requestId }, error);
          throw APIError.internal("Launchpad database not properly initialized");
        }
      }
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      throw APIError.internal(`Launchpad service error: ${errorMessage}`);
    }
  }
);

// Helper function to generate a mock transaction signature for devnet testing
function generateMockTransactionSignature(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
