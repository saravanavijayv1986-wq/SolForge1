import { api, APIError } from "encore.dev/api";
import { Connection, PublicKey } from "@solana/web3.js";
import { secret } from "encore.dev/config";

const solanaRpcUrl = secret("SolanaRpcUrl");

export interface VerifyTransactionRequest {
  transactionSignature: string;
  expectedAmount?: string; // Expected amount in SOL
  expectedRecipient?: string; // Expected recipient address
}

export interface VerifyTransactionResponse {
  verified: boolean;
  transaction: {
    signature: string;
    status: string;
    amount?: string;
    from?: string;
    to?: string;
    blockTime?: number;
    confirmations: number;
    slot?: number;
    fee?: string;
  };
}

export interface GetBalanceRequest {
  walletAddress: string;
}

export interface GetBalanceResponse {
  balance: string; // Balance in SOL
  lamports: string; // Balance in lamports
  lastUpdated: number; // Timestamp
}

// Verifies a transaction on Solana blockchain
export const verifyTransaction = api<VerifyTransactionRequest, VerifyTransactionResponse>(
  { expose: true, method: "POST", path: "/wallet/verify-transaction" },
  async (req) => {
    try {
      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      
      // Get transaction details with retries for mainnet
      let transaction;
      let attempts = 0;
      const maxAttempts = 5;
      
      while (attempts < maxAttempts) {
        try {
          transaction = await connection.getTransaction(req.transactionSignature, {
            commitment: 'confirmed',
            maxSupportedTransactionVersion: 0
          });
          break;
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            if (error instanceof Error && error.message.includes('429')) {
              throw APIError.resourceExhausted("Network is congested. Please try again in a moment.");
            }
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
        }
      }

      if (!transaction) {
        throw APIError.notFound("Transaction not found or not yet confirmed");
      }

      // Check if transaction was successful
      const isSuccessful = transaction.meta?.err === null;
      if (!isSuccessful) {
        return {
          verified: false,
          transaction: {
            signature: req.transactionSignature,
            status: 'failed',
            confirmations: 0
          }
        };
      }

      // Get transaction details
      const blockTime = transaction.blockTime;
      const slot = transaction.slot;
      const fee = transaction.meta?.fee ? (transaction.meta.fee / 1e9).toString() : undefined;
      const preBalances = transaction.meta?.preBalances || [];
      const postBalances = transaction.meta?.postBalances || [];
      const accountKeys = transaction.transaction.message.accountKeys;

      // Find SOL transfer amount and addresses
      let transferAmount: string | undefined;
      let fromAddress: string | undefined;
      let toAddress: string | undefined;

      if (preBalances.length > 0 && postBalances.length > 0) {
        // Find the account that sent SOL (balance decreased the most, excluding fee payer)
        let maxDecrease = 0;
        let fromIndex = -1;
        
        for (let i = 0; i < preBalances.length; i++) {
          const balanceChange = preBalances[i] - postBalances[i];
          if (balanceChange > maxDecrease) {
            maxDecrease = balanceChange;
            fromIndex = i;
          }
        }
        
        if (fromIndex >= 0) {
          fromAddress = accountKeys[fromIndex].toString();
          // For fee payer, subtract the fee to get actual transfer amount
          const actualTransfer = fromIndex === 0 ? maxDecrease - (transaction.meta?.fee || 0) : maxDecrease;
          transferAmount = (actualTransfer / 1e9).toString();
        }

        // Find the account that received SOL (balance increased)
        for (let i = 0; i < preBalances.length; i++) {
          const balanceChange = postBalances[i] - preBalances[i];
          if (balanceChange > 0 && i !== fromIndex) {
            toAddress = accountKeys[i].toString();
            break;
          }
        }
      }

      // Verify expected amount if provided
      let verified = true;
      if (req.expectedAmount && transferAmount) {
        const expectedAmountNum = parseFloat(req.expectedAmount);
        const actualAmountNum = parseFloat(transferAmount);
        verified = Math.abs(expectedAmountNum - actualAmountNum) < 0.000001; // Allow for small rounding differences
      }

      // Verify expected recipient if provided
      if (req.expectedRecipient && toAddress) {
        verified = verified && toAddress === req.expectedRecipient;
      }

      // Get confirmation count
      const currentSlot = await connection.getSlot('confirmed');
      const confirmations = slot ? Math.max(0, currentSlot - slot) : 0;

      return {
        verified,
        transaction: {
          signature: req.transactionSignature,
          status: isSuccessful ? 'confirmed' : 'failed',
          amount: transferAmount,
          from: fromAddress,
          to: toAddress,
          blockTime: blockTime || undefined,
          confirmations,
          slot,
          fee
        }
      };

    } catch (error) {
      console.error("Transaction verification error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }

      // Handle specific Solana errors
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          throw APIError.notFound("Transaction not found on blockchain");
        }
        if (error.message.includes('timeout') || error.message.includes('network')) {
          throw APIError.unavailable("Solana network is currently unavailable");
        }
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          throw APIError.resourceExhausted("Network is congested. Please try again in a moment.");
        }
      }
      
      throw APIError.internal("Failed to verify transaction");
    }
  }
);

// Gets the SOL balance of a wallet with enhanced error handling
export const getBalance = api<GetBalanceRequest, GetBalanceResponse>(
  { expose: true, method: "GET", path: "/wallet/:walletAddress/balance" },
  async (req) => {
    try {
      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      const publicKey = new PublicKey(req.walletAddress);
      
      // Get balance with retries for mainnet reliability
      let balance;
      let attempts = 0;
      const maxAttempts = 3;
      
      while (attempts < maxAttempts) {
        try {
          balance = await connection.getBalance(publicKey, 'confirmed');
          break;
        } catch (error) {
          attempts++;
          if (attempts === maxAttempts) {
            if (error instanceof Error && error.message.includes('429')) {
              throw APIError.resourceExhausted("Network is congested. Please try again in a moment.");
            }
            throw error;
          }
          await new Promise(resolve => setTimeout(resolve, 1000 * attempts)); // Exponential backoff
        }
      }
      
      const solBalance = (balance / 1e9).toString(); // Convert lamports to SOL

      return {
        balance: solBalance,
        lamports: balance.toString(),
        lastUpdated: Date.now()
      };

    } catch (error) {
      console.error("Balance check error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      if (error instanceof Error) {
        if (error.message.includes('Invalid public key')) {
          throw APIError.invalidArgument("Invalid wallet address format");
        }
        if (error.message.includes('timeout') || error.message.includes('network')) {
          throw APIError.unavailable("Solana network is currently unavailable");
        }
        if (error.message.includes('429') || error.message.includes('rate limit')) {
          throw APIError.resourceExhausted("Network is congested. Please try again in a moment.");
        }
      }
      
      throw APIError.internal("Failed to get wallet balance");
    }
  }
);
