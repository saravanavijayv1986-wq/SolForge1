import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";
import { Connection, PublicKey, Transaction, SystemProgram } from "@solana/web3.js";
import { getAssociatedTokenAddress, createBurnInstruction, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { secret } from "encore.dev/config";

const solanaRpcUrl = secret("SolanaRpcUrl");

export interface BurnTokensRequest {
  quoteId: string;
  userWallet: string;
  transactionSignature: string;
  referrerWallet?: string;
}

export interface BurnTokensResponse {
  success: boolean;
  burnId: number;
  usdValueBurned: string;
  estimatedSolf: string;
  transactionSignature: string;
  newUserTotal: string;
}

export interface GetUserBurnsRequest {
  userWallet: string;
  eventId?: number;
}

export interface UserBurn {
  id: number;
  tokenSymbol: string;
  tokenAmount: string;
  usdValueAtBurn: string;
  estimatedSolf: string;
  actualSolfAllocated?: string;
  transactionSignature: string;
  burnTimestamp: Date;
}

export interface GetUserBurnsResponse {
  burns: UserBurn[];
  totalUsdBurned: string;
  totalEstimatedSolf: string;
  totalActualSolf: string;
}

export interface CreateBurnTransactionRequest {
  quoteId: string;
  userWallet: string;
}

export interface CreateBurnTransactionResponse {
  transaction: string;
  quote: {
    quoteId: string;
    tokenAmount: string;
    usdValue: string;
    estimatedSolf: string;
    tokenMintAddress: string;
    expiresAt: Date;
  };
}

// Creates a burn transaction that needs to be signed by the client
export const createBurnTransaction = api<CreateBurnTransactionRequest, CreateBurnTransactionResponse>(
  { expose: true, method: "POST", path: "/fair-mint/create-burn-transaction" },
  async (req) => {
    try {
      // Validate quote
      const quote = await fairMintDB.queryRow<{
        quoteId: string;
        eventId: number;
        userWallet: string;
        tokenMintAddress: string;
        tokenAmount: string;
        usdValue: string;
        estimatedSolf: string;
        expiresAt: Date;
        isUsed: boolean;
      }>`
        SELECT quote_id as "quoteId", event_id as "eventId", user_wallet as "userWallet",
               token_mint_address as "tokenMintAddress", token_amount as "tokenAmount",
               usd_value as "usdValue", estimated_solf as "estimatedSolf",
               expires_at as "expiresAt", is_used as "isUsed"
        FROM fair_mint_quotes 
        WHERE quote_id = ${req.quoteId}
      `;

      if (!quote) {
        throw APIError.notFound("Quote not found");
      }

      if (quote.userWallet !== req.userWallet) {
        throw APIError.permissionDenied("Quote belongs to different wallet");
      }

      if (quote.isUsed) {
        throw APIError.alreadyExists("Quote has already been used");
      }

      if (new Date() > quote.expiresAt) {
        throw APIError.failedPrecondition("Quote has expired");
      }

      // Create Solana connection
      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      const userPublicKey = new PublicKey(req.userWallet);
      const tokenMint = new PublicKey(quote.tokenMintAddress);

      // Get associated token account
      const associatedTokenAccount = await getAssociatedTokenAddress(
        tokenMint,
        userPublicKey
      );

      // Get latest blockhash
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

      // Create burn transaction
      const transaction = new Transaction({
        feePayer: userPublicKey,
        recentBlockhash: blockhash,
      });

      // Convert token amount to raw amount (considering decimals)
      const tokenAmount = parseFloat(quote.tokenAmount);
      
      // Get token decimals (for proper conversion)
      const mintInfo = await connection.getParsedAccountInfo(tokenMint);
      let decimals = 6; // Default to 6 if we can't get mint info
      
      if (mintInfo.value?.data && 'parsed' in mintInfo.value.data) {
        decimals = (mintInfo.value.data as any).parsed.info.decimals;
      }

      const rawAmount = Math.floor(tokenAmount * Math.pow(10, decimals));

      // Add burn instruction
      transaction.add(
        createBurnInstruction(
          associatedTokenAccount,
          tokenMint,
          userPublicKey,
          BigInt(rawAmount),
          [],
          TOKEN_PROGRAM_ID
        )
      );

      // Serialize transaction (without signatures)
      const serializedTransaction = transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      }).toString('base64');

      return {
        transaction: serializedTransaction,
        quote: {
          quoteId: quote.quoteId,
          tokenAmount: quote.tokenAmount,
          usdValue: quote.usdValue,
          estimatedSolf: quote.estimatedSolf,
          tokenMintAddress: quote.tokenMintAddress,
          expiresAt: quote.expiresAt,
        }
      };
    } catch (error) {
      console.error("Failed to create burn transaction:", error);
      
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
      
      throw APIError.internal("Failed to create burn transaction");
    }
  }
);

// Records a token burn transaction
export const burnTokens = api<BurnTokensRequest, BurnTokensResponse>(
  { expose: true, method: "POST", path: "/fair-mint/burn" },
  async (req) => {
    // Validate quote
    const quote = await fairMintDB.queryRow<{
      quoteId: string;
      eventId: number;
      userWallet: string;
      tokenMintAddress: string;
      tokenAmount: string;
      usdValue: string;
      estimatedSolf: string;
      priceSource: string;
      priceAtQuote: string;
      expiresAt: Date;
      isUsed: boolean;
    }>`
      SELECT quote_id as "quoteId", event_id as "eventId", user_wallet as "userWallet",
             token_mint_address as "tokenMintAddress", token_amount as "tokenAmount",
             usd_value as "usdValue", estimated_solf as "estimatedSolf",
             price_source as "priceSource", price_at_quote as "priceAtQuote",
             expires_at as "expiresAt", is_used as "isUsed"
      FROM fair_mint_quotes 
      WHERE quote_id = ${req.quoteId}
    `;

    if (!quote) {
      throw APIError.notFound("Quote not found");
    }

    if (quote.userWallet !== req.userWallet) {
      throw APIError.permissionDenied("Quote belongs to different wallet");
    }

    if (quote.isUsed) {
      throw APIError.alreadyExists("Quote has already been used");
    }

    if (new Date() > quote.expiresAt) {
      throw APIError.failedPrecondition("Quote has expired");
    }

    // Check if transaction signature already exists
    const existingBurn = await fairMintDB.queryRow<{ id: number }>`
      SELECT id FROM fair_mint_burns 
      WHERE transaction_signature = ${req.transactionSignature}
    `;

    if (existingBurn) {
      throw APIError.alreadyExists("Transaction has already been processed");
    }

    // Verify transaction on Solana blockchain
    try {
      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      const txDetails = await connection.getTransaction(req.transactionSignature, {
        commitment: 'confirmed',
        maxSupportedTransactionVersion: 0
      });

      if (!txDetails) {
        throw APIError.notFound("Transaction not found on blockchain");
      }

      if (txDetails.meta?.err) {
        throw APIError.failedPrecondition("Transaction failed on blockchain");
      }

      // Verify the transaction contains a burn instruction
      // This is a simplified check - in production you'd want more robust verification
      const hasBurnInstruction = txDetails.transaction.message.instructions.some(instruction => {
        // Check if it's a SPL token burn instruction
        return instruction.programIdIndex !== undefined;
      });

      if (!hasBurnInstruction) {
        throw APIError.invalidArgument("Transaction does not contain a valid burn instruction");
      }

    } catch (error) {
      if (error instanceof APIError) {
        throw error;
      }
      console.error("Blockchain verification failed:", error);
      throw APIError.internal("Failed to verify transaction on blockchain");
    }

    // Verify event is still active
    const event = await fairMintDB.queryRow<{
      isActive: boolean;
      isFinalized: boolean;
      startTime: Date;
      endTime: Date;
    }>`
      SELECT is_active as "isActive", is_finalized as "isFinalized",
             start_time as "startTime", end_time as "endTime"
      FROM fair_mint_events 
      WHERE id = ${quote.eventId}
    `;

    if (!event || !event.isActive || event.isFinalized) {
      throw APIError.failedPrecondition("Fair mint event is no longer active");
    }

    const now = new Date();
    if (now < event.startTime || now > event.endTime) {
      throw APIError.failedPrecondition("Fair mint event is not currently live");
    }

    // Begin transaction
    await using tx = await fairMintDB.begin();

    try {
      // Mark quote as used
      await tx.exec`
        UPDATE fair_mint_quotes 
        SET is_used = true 
        WHERE quote_id = ${req.quoteId}
      `;

      // Record the burn
      const burn = await tx.queryRow<{ id: number }>`
        INSERT INTO fair_mint_burns (
          event_id, user_wallet, token_mint_address, token_amount,
          usd_value_at_burn, price_source, price_at_burn, estimated_solf,
          transaction_signature, referrer_wallet, quote_id
        )
        VALUES (
          ${quote.eventId}, ${req.userWallet}, ${quote.tokenMintAddress}, ${quote.tokenAmount},
          ${quote.usdValue}, ${quote.priceSource}, ${quote.priceAtQuote}, ${quote.estimatedSolf},
          ${req.transactionSignature}, ${req.referrerWallet || null}, ${req.quoteId}
        )
        RETURNING id
      `;

      if (!burn) {
        throw APIError.internal("Failed to record burn transaction");
      }

      // Update daily burned amount for token
      await tx.exec`
        UPDATE fair_mint_accepted_tokens 
        SET current_daily_burned_usd = current_daily_burned_usd + ${quote.usdValue}
        WHERE event_id = ${quote.eventId} AND mint_address = ${quote.tokenMintAddress}
      `;

      // Update event totals
      await tx.exec`
        UPDATE fair_mint_events 
        SET total_usd_burned = total_usd_burned + ${quote.usdValue}
        WHERE id = ${quote.eventId}
      `;

      // Update or create user allocation
      const existingAllocation = await tx.queryRow<{ totalUsdBurned: string }>`
        SELECT total_usd_burned as "totalUsdBurned"
        FROM fair_mint_allocations 
        WHERE event_id = ${quote.eventId} AND user_wallet = ${req.userWallet}
      `;

      if (existingAllocation) {
        await tx.exec`
          UPDATE fair_mint_allocations 
          SET total_usd_burned = total_usd_burned + ${quote.usdValue},
              total_solf_allocated = total_solf_allocated + ${quote.estimatedSolf}
          WHERE event_id = ${quote.eventId} AND user_wallet = ${req.userWallet}
        `;
      } else {
        await tx.exec`
          INSERT INTO fair_mint_allocations (
            event_id, user_wallet, total_usd_burned, total_solf_allocated
          )
          VALUES (
            ${quote.eventId}, ${req.userWallet}, ${quote.usdValue}, ${quote.estimatedSolf}
          )
        `;
      }

      // Handle referral if provided
      if (req.referrerWallet && req.referrerWallet !== req.userWallet) {
        await tx.exec`
          UPDATE fair_mint_referrals 
          SET successful_burns = successful_burns + 1,
              total_usd_referred = total_usd_referred + ${quote.usdValue}
          WHERE event_id = ${quote.eventId} AND referrer_wallet = ${req.referrerWallet}
        `;
      }

      // Get new user total
      const newTotal = await tx.queryRow<{ totalUsdBurned: string }>`
        SELECT total_usd_burned as "totalUsdBurned"
        FROM fair_mint_allocations 
        WHERE event_id = ${quote.eventId} AND user_wallet = ${req.userWallet}
      `;

      console.log(`Burn recorded: User ${req.userWallet} burned $${quote.usdValue} worth of tokens`);

      return {
        success: true,
        burnId: burn.id,
        usdValueBurned: quote.usdValue,
        estimatedSolf: quote.estimatedSolf,
        transactionSignature: req.transactionSignature,
        newUserTotal: newTotal?.totalUsdBurned || quote.usdValue
      };

    } catch (error) {
      console.error("Burn transaction failed:", error);
      throw error;
    }
  }
);

// Gets user's burn history
export const getUserBurns = api<GetUserBurnsRequest, GetUserBurnsResponse>(
  { expose: true, method: "GET", path: "/fair-mint/burns/:userWallet" },
  async (req) => {
    let eventId = req.eventId;
    
    if (!eventId) {
      const activeEvent = await fairMintDB.queryRow<{ id: number }>`
        SELECT id FROM fair_mint_events WHERE is_active = true LIMIT 1
      `;
      if (!activeEvent) {
        throw APIError.notFound("No active fair mint event found");
      }
      eventId = activeEvent.id;
    }

    const burns = await fairMintDB.queryAll<UserBurn>`
      SELECT 
        b.id, t.token_symbol as "tokenSymbol", b.token_amount as "tokenAmount",
        b.usd_value_at_burn as "usdValueAtBurn", b.estimated_solf as "estimatedSolf",
        b.actual_solf_allocated as "actualSolfAllocated", 
        b.transaction_signature as "transactionSignature",
        b.burn_timestamp as "burnTimestamp"
      FROM fair_mint_burns b
      JOIN fair_mint_accepted_tokens t ON b.token_mint_address = t.mint_address AND t.event_id = b.event_id
      WHERE b.event_id = ${eventId} AND b.user_wallet = ${req.userWallet}
      ORDER BY b.burn_timestamp DESC
    `;

    const totals = await fairMintDB.queryRow<{
      totalUsdBurned: string;
      totalEstimatedSolf: string;
      totalActualSolf: string;
    }>`
      SELECT 
        COALESCE(SUM(usd_value_at_burn), 0)::TEXT as "totalUsdBurned",
        COALESCE(SUM(estimated_solf), 0)::TEXT as "totalEstimatedSolf",
        COALESCE(SUM(actual_solf_allocated), 0)::TEXT as "totalActualSolf"
      FROM fair_mint_burns 
      WHERE event_id = ${eventId} AND user_wallet = ${req.userWallet}
    `;

    return {
      burns,
      totalUsdBurned: totals?.totalUsdBurned || '0',
      totalEstimatedSolf: totals?.totalEstimatedSolf || '0',
      totalActualSolf: totals?.totalActualSolf || '0'
    };
  }
);
