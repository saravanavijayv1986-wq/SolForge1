import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Connection, PublicKey, Keypair } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, createTransferInstruction, getAccount } from "@solana/spl-token";
import { launchpadDB } from "./db";

const solanaRpcUrl = secret("SolanaRpcUrl");
const solfMint = secret("SolfMint");
const treasuryWallet = secret("TreasuryWallet");
const teamWallet = secret("TeamWallet");
const treasurySigner = secret("TreasurySigner");

// Constants
const SOLF_PER_SOL = 10000;
const FEE_AMOUNT_SOL = 0.1;
const LAMPORTS_PER_SOL = 1000000000;
const MIN_PURCHASE_SOL = 0.2;

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
    try {
      // Validate input
      if (!req.wallet || req.wallet.trim().length === 0) {
        throw APIError.invalidArgument("Wallet address is required");
      }
      
      if (!req.txSig || req.txSig.trim().length === 0) {
        throw APIError.invalidArgument("Transaction signature is required");
      }

      // Check for existing purchase with this transaction signature (idempotent)
      const existingPurchase = await launchpadDB.queryRow<PurchaseRecord>`
        SELECT id, wallet, sol_sent as "solSent", solf_paid as "solfPaid", 
               fee_paid as "feePaid", tx_sig as "txSig", created_at as "createdAt"
        FROM launchpad_purchases 
        WHERE tx_sig = ${req.txSig}
      `;

      if (existingPurchase) {
        return {
          ok: true,
          solSpent: existingPurchase.solSent,
          solfReceived: existingPurchase.solfPaid,
          feePaid: existingPurchase.feePaid,
          txSig: existingPurchase.txSig
        };
      }

      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      
      // Verify the transaction
      const transaction = await connection.getTransaction(req.txSig, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!transaction) {
        throw APIError.notFound("Transaction not found or not yet confirmed");
      }

      if (transaction.meta?.err) {
        throw APIError.failedPrecondition("Transaction failed on-chain");
      }

      const accountKeys = transaction.transaction.message.accountKeys;
      const preBalances = transaction.meta?.preBalances || [];
      const postBalances = transaction.meta?.postBalances || [];

      // Verify signer is the user wallet
      const signerPubkey = accountKeys[0].toString();
      if (signerPubkey !== req.wallet) {
        throw APIError.invalidArgument("Transaction signer does not match provided wallet");
      }

      // Find transfers to treasury and team wallets
      let treasuryTransfer = 0;
      let teamTransfer = 0;
      
      const treasuryPubkey = treasuryWallet();
      const teamPubkey = teamWallet();

      for (let i = 0; i < accountKeys.length; i++) {
        const accountKey = accountKeys[i].toString();
        const balanceChange = (postBalances[i] || 0) - (preBalances[i] || 0);
        
        if (accountKey === treasuryPubkey) {
          treasuryTransfer = balanceChange / LAMPORTS_PER_SOL;
        } else if (accountKey === teamPubkey) {
          teamTransfer = balanceChange / LAMPORTS_PER_SOL;
        }
      }

      // Validate transfer amounts
      if (treasuryTransfer < MIN_PURCHASE_SOL) {
        throw APIError.failedPrecondition(`Invalid treasury transfer amount: ${treasuryTransfer} SOL. Expected at least ${MIN_PURCHASE_SOL} SOL.`);
      }

      if (teamTransfer < FEE_AMOUNT_SOL) {
        throw APIError.failedPrecondition(`Invalid fee amount: ${teamTransfer} SOL. Expected at least ${FEE_AMOUNT_SOL} SOL.`);
      }

      // Calculate SOLF to distribute
      const solSpent = treasuryTransfer;
      const solfToDistribute = Math.floor(solSpent * SOLF_PER_SOL);

      if (solfToDistribute <= 0) {
        throw APIError.invalidArgument("Invalid SOL amount for SOLF calculation");
      }

      // Check treasury SOLF balance
      const solfMintPubkey = new PublicKey(solfMint());
      const treasuryPubkey_pk = new PublicKey(treasuryPubkey);
      const treasuryATA = getAssociatedTokenAddressSync(solfMintPubkey, treasuryPubkey_pk);
      
      try {
        const treasuryTokenAccount = await getAccount(connection, treasuryATA);
        const treasuryBalance = Number(treasuryTokenAccount.amount);
        
        if (treasuryBalance < solfToDistribute) {
          throw APIError.failedPrecondition(`Insufficient SOLF in treasury. Available: ${treasuryBalance}, Required: ${solfToDistribute}`);
        }
      } catch (error) {
        console.error("Error checking treasury balance:", error);
        throw APIError.internal("Failed to verify treasury SOLF balance");
      }

      // Get user's associated token account
      const userPubkey = new PublicKey(req.wallet);
      const userATA = getAssociatedTokenAddressSync(solfMintPubkey, userPubkey);

      // Prepare SOLF transfer from treasury to user
      const treasuryKeypair = Keypair.fromSecretKey(
        Buffer.from(JSON.parse(treasurySigner()))
      );

      let distributionTxSig: string | undefined;

      try {
        // Create and send SOLF transfer transaction
        const { Transaction, SystemProgram } = await import("@solana/web3.js");
        const { createAssociatedTokenAccountInstruction } = await import("@solana/spl-token");
        
        const transferTx = new Transaction();
        
        // Check if user ATA exists, if not create it
        try {
          await getAccount(connection, userATA);
        } catch (error) {
          // ATA doesn't exist, add instruction to create it
          transferTx.add(
            createAssociatedTokenAccountInstruction(
              treasuryKeypair.publicKey,
              userATA,
              userPubkey,
              solfMintPubkey
            )
          );
        }

        // Add SOLF transfer instruction
        transferTx.add(
          createTransferInstruction(
            treasuryATA,
            userATA,
            treasuryKeypair.publicKey,
            solfToDistribute
          )
        );

        // Set recent blockhash
        const { blockhash } = await connection.getLatestBlockhash('confirmed');
        transferTx.recentBlockhash = blockhash;
        transferTx.feePayer = treasuryKeypair.publicKey;

        // Sign and send transaction
        transferTx.sign(treasuryKeypair);
        distributionTxSig = await connection.sendRawTransaction(transferTx.serialize(), {
          skipPreflight: false,
          preflightCommitment: 'confirmed'
        });

        // Wait for confirmation
        const confirmation = await connection.confirmTransaction(distributionTxSig, 'confirmed');
        if (confirmation.value.err) {
          throw new Error(`SOLF transfer failed: ${JSON.stringify(confirmation.value.err)}`);
        }

      } catch (error) {
        console.error("SOLF distribution failed:", error);
        throw APIError.internal("Failed to distribute SOLF tokens");
      }

      // Record the purchase in database
      const purchaseRecord = await launchpadDB.queryRow<PurchaseRecord>`
        INSERT INTO launchpad_purchases (wallet, sol_sent, solf_paid, fee_paid, tx_sig)
        VALUES (${req.wallet}, ${solSpent}, ${solfToDistribute}, ${teamTransfer}, ${req.txSig})
        RETURNING id, wallet, sol_sent as "solSent", solf_paid as "solfPaid", 
                  fee_paid as "feePaid", tx_sig as "txSig", created_at as "createdAt"
      `;

      if (!purchaseRecord) {
        throw APIError.internal("Failed to record purchase");
      }

      return {
        ok: true,
        solSpent: solSpent.toString(),
        solfReceived: solfToDistribute.toString(),
        feePaid: teamTransfer.toString(),
        txSig: req.txSig,
        distributionTxSig
      };

    } catch (error) {
      console.error("Launchpad buy error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("An unexpected error occurred during SOLF purchase");
    }
  }
);
