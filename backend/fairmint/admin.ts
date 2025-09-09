import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { fairMintDB } from "./db";
import type { FairMintEvent, AcceptedToken } from "./event";

const adminWalletAddress = secret("AdminWalletAddress");

interface AcceptedTokenRequest {
  mintAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  dailyCapUsd: string;
  dexPriceSource?: string;
}

interface CreateFairMintEventRequest {
  adminWallet: string;
  eventName: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  acceptedTokens: AcceptedTokenRequest[];
  tgePercentage: number;
  vestingDays: number;
  platformFeeBps: number;
  maxPerWalletUsd: string;
  maxPerTxUsd: string;
  quoteTtlSeconds: number;
  minTxUsd: string;
  treasuryAddress: string;
  referralPoolPercentage: number;
}

interface CreateFairMintEventResponse {
  event: FairMintEvent;
  acceptedTokens: AcceptedToken[];
}

interface GetAdminWalletResponse {
  adminWallet: string;
}

// Gets the admin wallet address for verification
export const getAdminWallet = api<void, GetAdminWalletResponse>(
  { expose: true, method: "GET", path: "/fair-mint/admin/wallet" },
  async () => {
    try {
      const wallet = adminWalletAddress();
      return { adminWallet: wallet };
    } catch (error) {
      console.error("Failed to get admin wallet secret:", error);
      throw APIError.internal("Admin wallet secret is not configured. Please set it in the infrastructure settings.");
    }
  }
);

// Creates a new fair mint event (admin only)
export const createEvent = api<CreateFairMintEventRequest, CreateFairMintEventResponse>(
  { expose: true, method: "POST", path: "/fair-mint/admin/create-event" },
  async (req) => {
    try {
      // 1. Authenticate admin
      let expectedAdminWallet: string;
      try {
        expectedAdminWallet = adminWalletAddress();
      } catch (e) {
        console.error("Admin wallet secret not set:", e);
        throw APIError.internal("Admin wallet secret is not configured. Please set it in the infrastructure settings.");
      }

      if (req.adminWallet !== expectedAdminWallet) {
        console.warn(`Unauthorized admin access attempt from: ${req.adminWallet}`);
        console.warn(`Expected admin wallet: ${expectedAdminWallet}`);
        throw APIError.permissionDenied("You are not authorized to create a fair mint event.");
      }

      // 2. Validate request data
      if (new Date(req.startTime) >= new Date(req.endTime)) {
        throw APIError.invalidArgument("Start time must be before end time.");
      }

      if (new Date(req.startTime) <= new Date()) {
        throw APIError.invalidArgument("Start time must be in the future.");
      }

      if (req.acceptedTokens.length === 0) {
        throw APIError.invalidArgument("At least one accepted token is required.");
      }

      if (req.acceptedTokens.length > 20) {
        throw APIError.invalidArgument("Maximum 20 accepted tokens allowed.");
      }

      // Validate percentages and numbers
      if (req.tgePercentage < 0 || req.tgePercentage > 100) {
        throw APIError.invalidArgument("TGE percentage must be between 0 and 100.");
      }

      if (req.vestingDays < 1 || req.vestingDays > 365) {
        throw APIError.invalidArgument("Vesting days must be between 1 and 365.");
      }

      if (req.platformFeeBps < 0 || req.platformFeeBps > 1000) {
        throw APIError.invalidArgument("Platform fee must be between 0 and 10% (1000 bps).");
      }

      if (req.referralPoolPercentage < 0 || req.referralPoolPercentage > 20) {
        throw APIError.invalidArgument("Referral pool percentage must be between 0 and 20%.");
      }

      // Validate token addresses
      for (const token of req.acceptedTokens) {
        if (!token.mintAddress || token.mintAddress.length < 32) {
          throw APIError.invalidArgument(`Invalid mint address for token ${token.tokenSymbol}`);
        }

        if (!token.tokenName || token.tokenName.trim().length === 0) {
          throw APIError.invalidArgument(`Token name is required for ${token.tokenSymbol}`);
        }

        if (!token.tokenSymbol || token.tokenSymbol.trim().length === 0) {
          throw APIError.invalidArgument("Token symbol is required for all tokens");
        }

        const dailyCapUsdNum = parseFloat(token.dailyCapUsd);
        if (isNaN(dailyCapUsdNum) || dailyCapUsdNum <= 0) {
          throw APIError.invalidArgument(`Invalid daily cap for token ${token.tokenSymbol}`);
        }
      }

      // Validate USD amounts
      const maxPerWalletUsdNum = parseFloat(req.maxPerWalletUsd);
      const maxPerTxUsdNum = parseFloat(req.maxPerTxUsd);
      const minTxUsdNum = parseFloat(req.minTxUsd);

      if (isNaN(maxPerWalletUsdNum) || maxPerWalletUsdNum <= 0) {
        throw APIError.invalidArgument("Invalid max per wallet USD amount.");
      }

      if (isNaN(maxPerTxUsdNum) || maxPerTxUsdNum <= 0) {
        throw APIError.invalidArgument("Invalid max per transaction USD amount.");
      }

      if (isNaN(minTxUsdNum) || minTxUsdNum < 0) {
        throw APIError.invalidArgument("Invalid minimum transaction USD amount.");
      }

      if (maxPerTxUsdNum > maxPerWalletUsdNum) {
        throw APIError.invalidArgument("Max per transaction cannot exceed max per wallet.");
      }

      if (minTxUsdNum > maxPerTxUsdNum) {
        throw APIError.invalidArgument("Minimum transaction cannot exceed maximum transaction.");
      }

      // Validate treasury address
      if (!req.treasuryAddress || req.treasuryAddress.length < 32) {
        throw APIError.invalidArgument("Valid treasury address is required.");
      }

      // 3. Start DB transaction
      await using tx = await fairMintDB.begin();

      try {
        // 4. Deactivate any existing active events
        await tx.exec`UPDATE fair_mint_events SET is_active = false WHERE is_active = true`;

        // 5. Insert new event
        const event = await tx.queryRow<FairMintEvent>`
          INSERT INTO fair_mint_events (
            event_name, description, start_time, end_time, is_active,
            tge_percentage, vesting_days, platform_fee_bps, max_per_wallet_usd,
            max_per_tx_usd, quote_ttl_seconds, min_tx_usd, treasury_address,
            referral_pool_percentage
          ) VALUES (
            ${req.eventName}, ${req.description || null}, ${req.startTime}, ${req.endTime}, true,
            ${req.tgePercentage}, ${req.vestingDays}, ${req.platformFeeBps}, ${req.maxPerWalletUsd},
            ${req.maxPerTxUsd}, ${req.quoteTtlSeconds}, ${req.minTxUsd}, ${req.treasuryAddress},
            ${req.referralPoolPercentage}
          )
          RETURNING 
            id, event_name as "eventName", description, start_time as "startTime", 
            end_time as "endTime", is_active as "isActive", is_finalized as "isFinalized",
            total_usd_burned as "totalUsdBurned", total_solf_allocated as "totalSolfAllocated",
            solf_per_usd_rate as "solfPerUsdRate", tge_percentage as "tgePercentage",
            vesting_days as "vestingDays", platform_fee_bps as "platformFeeBps",
            max_per_wallet_usd as "maxPerWalletUsd", max_per_tx_usd as "maxPerTxUsd",
            quote_ttl_seconds as "quoteTtlSeconds", min_tx_usd as "minTxUsd",
            treasury_address as "treasuryAddress", referral_pool_percentage as "referralPoolPercentage",
            created_at as "createdAt", updated_at as "updatedAt"
        `;

        if (!event) {
          throw APIError.internal("Failed to create fair mint event.");
        }

        // 6. Insert accepted tokens
        const acceptedTokens: AcceptedToken[] = [];
        for (let i = 0; i < req.acceptedTokens.length; i++) {
          const token = req.acceptedTokens[i];
          
          // Check for duplicate mint addresses
          const duplicateCheck = acceptedTokens.find(t => t.mintAddress === token.mintAddress);
          if (duplicateCheck) {
            throw APIError.invalidArgument(`Duplicate mint address: ${token.mintAddress}`);
          }

          const acceptedToken = await tx.queryRow<AcceptedToken>`
            INSERT INTO fair_mint_accepted_tokens (
              event_id, mint_address, token_name, token_symbol, token_logo_url,
              daily_cap_usd, dex_price_source
            ) VALUES (
              ${event.id}, ${token.mintAddress}, ${token.tokenName.trim()}, ${token.tokenSymbol.trim().toUpperCase()}, ${token.tokenLogoUrl || null},
              ${token.dailyCapUsd}, ${token.dexPriceSource?.trim() || null}
            )
            RETURNING
              id, event_id as "eventId", mint_address as "mintAddress",
              token_name as "tokenName", token_symbol as "tokenSymbol",
              token_logo_url as "tokenLogoUrl", is_active as "isActive",
              daily_cap_usd as "dailyCapUsd", current_daily_burned_usd as "currentDailyBurnedUsd",
              last_daily_reset as "lastDailyReset",
              dex_price_source as "dexPriceSource", created_at as "createdAt"
          `;
          
          if (!acceptedToken) {
            throw APIError.internal(`Failed to add accepted token: ${token.tokenSymbol}`);
          }
          acceptedTokens.push(acceptedToken);
        }

        // 7. Log the event creation
        console.log(`Fair mint event created: "${event.eventName}" with ${acceptedTokens.length} tokens by admin ${req.adminWallet}`);

        // 8. Commit transaction is handled by `await using`
        return { event, acceptedTokens };
      } catch (error) {
        // Rollback is handled by `await using`
        console.error("Failed to create fair mint event:", error);
        if (error instanceof APIError) {
          throw error;
        }
        const errorMessage = error instanceof Error ? error.message : String(error);
        throw APIError.internal(`Database error during event creation: ${errorMessage}`);
      }
    } catch (error) {
      console.error("Admin event creation error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      // Log detailed error for debugging
      console.error("Detailed error:", {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        adminWallet: req.adminWallet,
        eventName: req.eventName
      });
      
      const errorMessage = error instanceof Error ? error.message : String(error);
      throw APIError.internal(`An unexpected error occurred: ${errorMessage}`);
    }
  }
);

// Emergency pause/resume functions
export const pauseEvent = api<{ adminWallet: string; eventId: number; reason?: string }, { success: boolean }>(
  { expose: true, method: "POST", path: "/fair-mint/admin/pause" },
  async (req) => {
    let expectedAdminWallet: string;
    try {
      expectedAdminWallet = adminWalletAddress();
    } catch (e) {
      console.error("Admin wallet secret not set:", e);
      throw APIError.internal("Admin wallet secret is not configured. Please set it in the infrastructure settings.");
    }

    if (req.adminWallet !== expectedAdminWallet) {
      throw APIError.permissionDenied("You are not authorized to pause events.");
    }

    await fairMintDB.exec`
      UPDATE fair_mint_events 
      SET is_active = false 
      WHERE id = ${req.eventId}
    `;

    await fairMintDB.exec`
      INSERT INTO fair_mint_pause_log (event_id, action, reason, admin_wallet)
      VALUES (${req.eventId}, 'pause', ${req.reason || 'Manual pause'}, ${req.adminWallet})
    `;

    console.log(`Event ${req.eventId} paused by admin ${req.adminWallet}: ${req.reason || 'No reason provided'}`);

    return { success: true };
  }
);

export const resumeEvent = api<{ adminWallet: string; eventId: number; reason?: string }, { success: boolean }>(
  { expose: true, method: "POST", path: "/fair-mint/admin/resume" },
  async (req) => {
    let expectedAdminWallet: string;
    try {
      expectedAdminWallet = adminWalletAddress();
    } catch (e) {
      console.error("Admin wallet secret not set:", e);
      throw APIError.internal("Admin wallet secret is not configured. Please set it in the infrastructure settings.");
    }

    if (req.adminWallet !== expectedAdminWallet) {
      throw APIError.permissionDenied("You are not authorized to resume events.");
    }

    await fairMintDB.exec`
      UPDATE fair_mint_events 
      SET is_active = true 
      WHERE id = ${req.eventId}
    `;

    await fairMintDB.exec`
      INSERT INTO fair_mint_pause_log (event_id, action, reason, admin_wallet)
      VALUES (${req.eventId}, 'resume', ${req.reason || 'Manual resume'}, ${req.adminWallet})
    `;

    console.log(`Event ${req.eventId} resumed by admin ${req.adminWallet}: ${req.reason || 'No reason provided'}`);

    return { success: true };
  }
);
