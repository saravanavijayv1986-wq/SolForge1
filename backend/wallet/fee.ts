import { api, APIError } from "encore.dev/api";
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { secret } from "encore.dev/config";

const solanaRpcUrl = secret("SolanaRpcUrl");
const adminWalletAddress = secret("AdminWalletAddress");

export interface ProcessFeeRequest {
  fromAddress: string;
  signedTransaction: string;
}

export interface ProcessFeeResponse {
  success: boolean;
  transactionSignature: string;
  feeAmount: string;
  verified: boolean;
}

export interface CreateFeeTransactionRequest {
  fromAddress: string;
}

export interface CreateFeeTransactionResponse {
  transaction: string;
  feeAmount: string;
}

// Creates a fee transaction that needs to be signed by the client
export const createFeeTransaction = api<CreateFeeTransactionRequest, CreateFeeTransactionResponse>(
  { expose: true, method: "POST", path: "/wallet/create-fee-transaction" },
  async (req) => {
    try {
      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      const fromPubkey = new PublicKey(req.fromAddress);
      const toPubkey = new PublicKey(adminWalletAddress());
      const feeAmount = 0.1 * LAMPORTS_PER_SOL; // 0.1 SOL in lamports

      // Check if sender has sufficient balance
      const balance = await connection.getBalance(fromPubkey, 'confirmed');
      const requiredAmount = feeAmount + 10000; // Fee amount + estimated transaction fee (higher for mainnet)
      
      if (balance < requiredAmount) {
        const solBalance = balance / LAMPORTS_PER_SOL;
        const requiredSol = requiredAmount / LAMPORTS_PER_SOL;
        throw APIError.failedPrecondition(
          `Insufficient balance. Required: ${requiredSol.toFixed(4)} SOL, Available: ${solBalance.toFixed(4)} SOL`
        );
      }

      // Get latest blockhash with retry logic and higher commitment
      let blockhash: string;
      let lastValidBlockHeight: number;
      
      try {
        const latestBlockhash = await connection.getLatestBlockhash('finalized');
        blockhash = latestBlockhash.blockhash;
        lastValidBlockHeight = latestBlockhash.lastValidBlockHeight;
      } catch (error) {
        console.error("Failed to get latest blockhash:", error);
        throw APIError.unavailable("Solana network is currently unavailable. Please try again.");
      }

      // Create transaction
      const transaction = new Transaction({
        feePayer: fromPubkey,
        recentBlockhash: blockhash,
      });

      // Add transfer instruction
      transaction.add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports: feeAmount,
        })
      );

      // Serialize transaction (without signatures)
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).toString('base64');

      return {
        transaction: serializedTransaction,
        feeAmount: (feeAmount / LAMPORTS_PER_SOL).toString(),
      };
    } catch (error) {
      console.error("Failed to create fee transaction:", error);
      
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
      
      throw APIError.internal("Failed to create fee transaction");
    }
  }
);

// Processes a signed fee transaction with comprehensive verification
export const processFee = api<ProcessFeeRequest, ProcessFeeResponse>(
  { expose: true, method: "POST", path: "/wallet/process-fee" },
  async (req) => {
    try {
      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      
      // Deserialize the signed transaction
      const transactionBuffer = Buffer.from(req.signedTransaction, 'base64');
      const transaction = Transaction.from(transactionBuffer);

      // Verify transaction structure
      if (!transaction.signatures || transaction.signatures.length === 0) {
        throw APIError.invalidArgument("Transaction is not signed");
      }

      // Send the transaction with retry logic and better error handling
      let signature: string;
      try {
        signature = await connection.sendRawTransaction(transaction.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'processed',
          maxRetries: 5
        });
      } catch (error) {
        console.error("Failed to send transaction:", error);
        
        if (error instanceof Error) {
          if (error.message.includes('insufficient funds')) {
            throw APIError.failedPrecondition("Insufficient SOL balance to complete transaction");
          }
          if (error.message.includes('blockhash not found') || error.message.includes('Blockhash not found')) {
            throw APIError.failedPrecondition("Transaction expired. Please create a new transaction.");
          }
          if (error.message.includes('already processed')) {
            throw APIError.alreadyExists("This transaction has already been processed");
          }
          if (error.message.includes('429') || error.message.includes('rate limit')) {
            throw APIError.resourceExhausted("Network is congested. Please try again in a moment.");
          }
          if (error.message.includes('simulate') || error.message.includes('failed')) {
            throw APIError.failedPrecondition("Transaction simulation failed. Please check your wallet balance and try again.");
          }
        }
        
        throw APIError.internal("Failed to submit transaction to Solana network");
      }
      
      // Confirm the transaction with extended timeout for mainnet
      let confirmed = false;
      let attempts = 0;
      const maxAttempts = 60; // 60 seconds timeout (longer for mainnet)
      
      while (!confirmed && attempts < maxAttempts) {
        try {
          const status = await connection.getSignatureStatus(signature);
          if (status?.value?.confirmationStatus === 'confirmed' || 
              status?.value?.confirmationStatus === 'finalized') {
            if (status.value.err) {
              throw APIError.internal(`Transaction failed: ${JSON.stringify(status.value.err)}`);
            }
            confirmed = true;
            break;
          }
        } catch (error) {
          console.error("Error checking transaction status:", error);
        }
        
        await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
        attempts++;
      }

      if (!confirmed) {
        throw APIError.unavailable("Transaction confirmation timeout. The transaction may still be processing.");
      }

      // Verify the transaction details with enhanced verification
      let verified = false;
      try {
        const txDetails = await connection.getTransaction(signature, {
          commitment: 'confirmed',
          maxSupportedTransactionVersion: 0
        });

        if (txDetails && txDetails.meta?.err === null) {
          // Verify the transfer amount and recipient
          const preBalances = txDetails.meta.preBalances || [];
          const postBalances = txDetails.meta.postBalances || [];
          const accountKeys = txDetails.transaction.message.accountKeys;
          
          // Check if admin wallet received the expected amount
          const adminWallet = adminWalletAddress();
          const adminIndex = accountKeys.findIndex(key => key.toString() === adminWallet);
          
          if (adminIndex >= 0 && adminIndex < preBalances.length && adminIndex < postBalances.length) {
            const balanceIncrease = postBalances[adminIndex] - preBalances[adminIndex];
            const expectedAmount = 0.1 * LAMPORTS_PER_SOL;
            verified = Math.abs(balanceIncrease - expectedAmount) < 1000; // Allow small variance
          }
        }
      } catch (error) {
        console.error("Error verifying transaction:", error);
        // Don't fail the whole process if verification fails
      }

      return {
        success: true,
        transactionSignature: signature,
        feeAmount: "0.1",
        verified
      };
    } catch (error) {
      console.error("Failed to process fee transaction:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("Failed to process fee transaction");
    }
  }
);
