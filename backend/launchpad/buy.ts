import { api, APIError } from "encore.dev/api";
import { validateInput } from "../shared/validation";
import { createLogger } from "../shared/logger";
import { metrics } from "../shared/monitoring";
import { SOLF_CONFIG, getWalletAddresses } from "../config/app";

const logger = createLogger('launchpad-buy');

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
      
      // For development, return a successful mock response
      const solSpent = 1.0;
      const teamFee = SOLF_CONFIG.platformFee;
      const solfToDistribute = Math.floor(solSpent * SOLF_CONFIG.exchangeRate);
      
      // Generate mock distribution transaction signature for devnet
      const mockDistributionTxSig = generateMockTransactionSignature();
      
      timer();
      metrics.increment('launchpad_buy_success');
      metrics.gauge('launchpad_sol_volume', solSpent);
      metrics.gauge('launchpad_solf_distributed', solfToDistribute);
      
      logger.info('Purchase processed successfully (development mode)', {
        requestId,
        solSpent,
        solfDistributed: solfToDistribute,
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
