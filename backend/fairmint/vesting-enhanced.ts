import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";
import { secret } from "encore.dev/config";

const adminWalletAddress = secret("AdminWalletAddress");

export interface VestingSchedule {
  id: number;
  eventId: number;
  userWallet: string;
  totalSolfAllocated: string;
  tgeAmount: string;
  vestingAmount: string;
  claimedTge: string;
  claimedVesting: string;
  vestingStartTime: Date;
  vestingEndTime: Date;
  lastClaimTime?: Date;
  isFullyClaimed: boolean;
  createdAt: Date;
}

export interface DetailedClaimableAmount {
  totalAllocated: string;
  tgeAmount: string;
  vestingAmount: string;
  claimedTge: string;
  claimedVesting: string;
  claimableTge: string;
  claimableVesting: string;
  totalClaimable: string;
  vestingProgress: number;
  dailyVestingRate: string;
  nextVestingDate?: Date;
  isFullyVested: boolean;
  estimatedFullVestDate: Date;
  vestingScheduleBreakdown: Array<{
    day: number;
    date: Date;
    amount: string;
    cumulative: string;
    claimed: boolean;
  }>;
}

export interface ClaimRequest {
  userWallet: string;
  eventId: number;
  claimType: 'tge' | 'vesting' | 'both';
  requestedAmount?: string; // For partial claims
}

export interface ClaimResponse {
  success: boolean;
  transactionSignature: string;
  claimedTge: string;
  claimedVesting: string;
  totalClaimed: string;
  remainingBalance: string;
  nextClaimableDate?: Date;
  gasFeePaid: string;
}

export interface VestingEventSummary {
  eventId: number;
  eventName: string;
  totalParticipants: number;
  totalSolfAllocated: string;
  totalTgeClaimed: string;
  totalVestingClaimed: string;
  totalRemainingToVest: string;
  vestingProgress: number;
  participantsFullyVested: number;
  participantsPartiallyVested: number;
  participantsNotStarted: number;
}

// Enhanced vesting schedule creation with detailed calculations
export const createDetailedVestingSchedules = api<{ 
  eventId: number; 
  adminWallet: string; 
  solfPerUsdRate: string;
  vestingStartDelay?: number; // Days after TGE
}, { 
  schedulesCreated: number; 
  totalSolfAllocated: string;
  breakdown: { tgeTotal: string; vestingTotal: string };
}>(
  { expose: true, method: "POST", path: "/fair-mint/vesting/create-detailed-schedules" },
  async (req) => {
    // Verify admin authorization
    const expectedAdminWallet = adminWalletAddress();
    if (req.adminWallet !== expectedAdminWallet) {
      throw APIError.permissionDenied("Only authorized administrators can create vesting schedules");
    }

    // Verify the event is ready for finalization
    const event = await fairMintDB.queryRow<{
      id: number;
      eventName: string;
      endTime: Date;
      isActive: boolean;
      isFinalized: boolean;
      tgePercentage: number;
      vestingDays: number;
      totalUsdBurned: string;
    }>`
      SELECT id, event_name as "eventName", end_time as "endTime",
             is_active as "isActive", is_finalized as "isFinalized",
             tge_percentage as "tgePercentage", vesting_days as "vestingDays",
             total_usd_burned as "totalUsdBurned"
      FROM fair_mint_events WHERE id = ${req.eventId}
    `;

    if (!event) {
      throw APIError.notFound("Event not found");
    }

    if (event.isFinalized) {
      throw APIError.alreadyExists("Event is already finalized with vesting schedules");
    }

    if (new Date() < event.endTime) {
      throw APIError.failedPrecondition("Event has not ended yet");
    }

    const solfPerUsd = parseFloat(req.solfPerUsdRate);
    if (isNaN(solfPerUsd) || solfPerUsd <= 0) {
      throw APIError.invalidArgument("Invalid SOLF per USD rate");
    }

    await using tx = await fairMintDB.begin();

    try {
      // Get all user allocations with detailed burn history
      const allocations = await tx.queryAll<{
        userWallet: string;
        totalUsdBurned: string;
        burnCount: number;
        firstBurnTime: Date;
        lastBurnTime: Date;
      }>`
        SELECT 
          user_wallet as "userWallet", 
          total_usd_burned as "totalUsdBurned",
          (SELECT COUNT(*) FROM fair_mint_burns WHERE event_id = ${req.eventId} AND user_wallet = a.user_wallet) as "burnCount",
          (SELECT MIN(burn_timestamp) FROM fair_mint_burns WHERE event_id = ${req.eventId} AND user_wallet = a.user_wallet) as "firstBurnTime",
          (SELECT MAX(burn_timestamp) FROM fair_mint_burns WHERE event_id = ${req.eventId} AND user_wallet = a.user_wallet) as "lastBurnTime"
        FROM fair_mint_allocations a
        WHERE event_id = ${req.eventId} AND total_usd_burned > 0
      `;

      let schedulesCreated = 0;
      let totalTgeAmount = 0;
      let totalVestingAmount = 0;
      let totalSolfAllocated = 0;

      // Calculate vesting timing
      const vestingStartDelay = req.vestingStartDelay || 0; // Default: start immediately
      const vestingStartTime = new Date(Date.now() + vestingStartDelay * 24 * 60 * 60 * 1000);
      const vestingEndTime = new Date(vestingStartTime.getTime() + event.vestingDays * 24 * 60 * 60 * 1000);

      for (const allocation of allocations) {
        const totalSolfForUser = parseFloat(allocation.totalUsdBurned) * solfPerUsd;
        const tgeAmount = totalSolfForUser * (event.tgePercentage / 100);
        const vestingAmount = totalSolfForUser - tgeAmount;

        // Create detailed vesting schedule
        await tx.exec`
          INSERT INTO fair_mint_vesting (
            event_id, user_wallet, total_solf_allocated, tge_amount, vesting_amount,
            vesting_start_time, vesting_end_time
          ) VALUES (
            ${req.eventId}, ${allocation.userWallet}, ${totalSolfForUser.toString()}::numeric,
            ${tgeAmount.toString()}::numeric, ${vestingAmount.toString()}::numeric,
            ${vestingStartTime}, ${vestingEndTime}
          )
        `;

        totalSolfAllocated += totalSolfForUser;
        totalTgeAmount += tgeAmount;
        totalVestingAmount += vestingAmount;
        schedulesCreated++;
      }

      // Update event as finalized with detailed metadata
      await tx.exec`
        UPDATE fair_mint_events 
        SET 
          is_finalized = true, 
          solf_per_usd_rate = ${req.solfPerUsdRate}::numeric, 
          is_active = false,
          total_solf_allocated = ${totalSolfAllocated.toString()}::numeric
        WHERE id = ${req.eventId}
      `;

      // Update all burns with actual SOLF allocated
      await tx.exec`
        UPDATE fair_mint_burns 
        SET actual_solf_allocated = CAST(usd_value_at_burn AS NUMERIC) * ${solfPerUsd}
        WHERE event_id = ${req.eventId}
      `;

      // Log the finalization action
      await tx.exec`
        INSERT INTO fair_mint_emergency_actions (event_id, action_type, admin_wallet, reason, parameters)
        VALUES (${req.eventId}, 'finalize', ${req.adminWallet}, 'Event finalization with vesting schedule creation', 
                jsonb_build_object('solfPerUsdRate', ${req.solfPerUsdRate}, 'schedulesCreated', ${schedulesCreated}))
      `;

      console.log(`Created ${schedulesCreated} detailed vesting schedules for event ${req.eventId} with rate ${solfPerUsd} SOLF per USD`);

      return { 
        schedulesCreated,
        totalSolfAllocated: totalSolfAllocated.toString(),
        breakdown: {
          tgeTotal: totalTgeAmount.toString(),
          vestingTotal: totalVestingAmount.toString()
        }
      };

    } catch (error) {
      console.error("Failed to create detailed vesting schedules:", error);
      throw error;
    }
  }
);

// Enhanced claimable amount calculation with detailed breakdown
export const getDetailedClaimableAmount = api<{ userWallet: string; eventId: number }, DetailedClaimableAmount>(
  { expose: true, method: "GET", path: "/fair-mint/vesting/detailed-claimable/:userWallet" },
  async (req) => {
    const vesting = await fairMintDB.queryRow<{
      totalSolfAllocated: string;
      tgeAmount: string;
      vestingAmount: string;
      claimedTge: string;
      claimedVesting: string;
      vestingStartTime: Date;
      vestingEndTime: Date;
      lastClaimTime?: Date;
    }>`
      SELECT total_solf_allocated as "totalSolfAllocated", tge_amount as "tgeAmount",
             vesting_amount as "vestingAmount", claimed_tge as "claimedTge",
             claimed_vesting as "claimedVesting", vesting_start_time as "vestingStartTime",
             vesting_end_time as "vestingEndTime", last_claim_time as "lastClaimTime"
      FROM fair_mint_vesting 
      WHERE user_wallet = ${req.userWallet} AND event_id = ${req.eventId}
    `;

    if (!vesting) {
      throw APIError.notFound("No vesting schedule found for this user and event");
    }

    const now = new Date();
    const totalVestingPeriod = vesting.vestingEndTime.getTime() - vesting.vestingStartTime.getTime();
    const elapsedVestingTime = Math.max(0, now.getTime() - vesting.vestingStartTime.getTime());
    const vestingProgress = Math.min(1, elapsedVestingTime / totalVestingPeriod);

    const totalVestingAmount = parseFloat(vesting.vestingAmount);
    const vestedAmount = totalVestingAmount * vestingProgress;
    const claimedVesting = parseFloat(vesting.claimedVesting);
    const claimedTge = parseFloat(vesting.claimedTge);

    const claimableTge = Math.max(0, parseFloat(vesting.tgeAmount) - claimedTge);
    const claimableVesting = Math.max(0, vestedAmount - claimedVesting);
    const totalClaimable = claimableTge + claimableVesting;

    // Calculate daily vesting rate
    const vestingDays = totalVestingPeriod / (24 * 60 * 60 * 1000);
    const dailyVestingRate = totalVestingAmount / vestingDays;

    const isFullyVested = vestingProgress >= 1;
    const nextVestingDate = isFullyVested ? undefined : new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // Create detailed vesting schedule breakdown
    const vestingScheduleBreakdown: Array<{
      day: number;
      date: Date;
      amount: string;
      cumulative: string;
      claimed: boolean;
    }> = [];

    const daysToShow = Math.min(30, Math.ceil(vestingDays)); // Show next 30 days or until end
    for (let day = 1; day <= daysToShow; day++) {
      const dayDate = new Date(vesting.vestingStartTime.getTime() + day * 24 * 60 * 60 * 1000);
      const dayAmount = dailyVestingRate;
      const cumulativeAmount = dayAmount * day;
      const claimed = dayDate <= now && cumulativeAmount <= claimedVesting + 0.000001; // Small tolerance for floating point

      vestingScheduleBreakdown.push({
        day,
        date: dayDate,
        amount: dayAmount.toString(),
        cumulative: Math.min(cumulativeAmount, totalVestingAmount).toString(),
        claimed
      });
    }

    return {
      totalAllocated: vesting.totalSolfAllocated,
      tgeAmount: vesting.tgeAmount,
      vestingAmount: vesting.vestingAmount,
      claimedTge: vesting.claimedTge,
      claimedVesting: vesting.claimedVesting,
      claimableTge: claimableTge.toString(),
      claimableVesting: claimableVesting.toString(),
      totalClaimable: totalClaimable.toString(),
      vestingProgress: vestingProgress * 100,
      dailyVestingRate: dailyVestingRate.toString(),
      nextVestingDate,
      isFullyVested,
      estimatedFullVestDate: vesting.vestingEndTime,
      vestingScheduleBreakdown
    };
  }
);

// Enhanced claim with partial claiming and better error handling
export const enhancedClaimTokens = api<ClaimRequest, ClaimResponse>(
  { expose: true, method: "POST", path: "/fair-mint/vesting/enhanced-claim" },
  async (req) => {
    const vesting = await fairMintDB.queryRow<{
      id: number;
      totalSolfAllocated: string;
      tgeAmount: string;
      vestingAmount: string;
      claimedTge: string;
      claimedVesting: string;
      vestingStartTime: Date;
      vestingEndTime: Date;
      lastClaimTime?: Date;
    }>`
      SELECT id, total_solf_allocated as "totalSolfAllocated", tge_amount as "tgeAmount",
             vesting_amount as "vestingAmount", claimed_tge as "claimedTge",
             claimed_vesting as "claimedVesting", vesting_start_time as "vestingStartTime",
             vesting_end_time as "vestingEndTime", last_claim_time as "lastClaimTime"
      FROM fair_mint_vesting 
      WHERE user_wallet = ${req.userWallet} AND event_id = ${req.eventId}
    `;

    if (!vesting) {
      throw APIError.notFound("No vesting schedule found for this user and event");
    }

    // Calculate claimable amounts
    const now = new Date();
    const totalVestingPeriod = vesting.vestingEndTime.getTime() - vesting.vestingStartTime.getTime();
    const elapsedVestingTime = Math.max(0, now.getTime() - vesting.vestingStartTime.getTime());
    const vestingProgress = Math.min(1, elapsedVestingTime / totalVestingPeriod);

    const totalVestingAmount = parseFloat(vesting.vestingAmount);
    const vestedAmount = totalVestingAmount * vestingProgress;
    const claimedVesting = parseFloat(vesting.claimedVesting);
    const claimedTge = parseFloat(vesting.claimedTge);

    let claimableTge = 0;
    let claimableVesting = 0;

    if (req.claimType === 'tge' || req.claimType === 'both') {
      claimableTge = Math.max(0, parseFloat(vesting.tgeAmount) - claimedTge);
    }

    if (req.claimType === 'vesting' || req.claimType === 'both') {
      claimableVesting = Math.max(0, vestedAmount - claimedVesting);
      
      // Handle partial claiming for vesting
      if (req.requestedAmount && req.claimType === 'vesting') {
        const requestedVesting = parseFloat(req.requestedAmount);
        claimableVesting = Math.min(claimableVesting, requestedVesting);
      }
    }

    const totalClaimable = claimableTge + claimableVesting;

    if (totalClaimable <= 0) {
      throw APIError.failedPrecondition("No tokens are currently claimable");
    }

    // Check for minimum claim amount (prevent dust claims)
    const minimumClaim = 0.1; // 0.1 SOLF minimum
    if (totalClaimable < minimumClaim) {
      throw APIError.failedPrecondition(`Minimum claim amount is ${minimumClaim} SOLF`);
    }

    // Rate limiting: prevent claims more frequent than once per hour
    if (vesting.lastClaimTime) {
      const timeSinceLastClaim = now.getTime() - vesting.lastClaimTime.getTime();
      const oneHour = 60 * 60 * 1000;
      if (timeSinceLastClaim < oneHour) {
        const remainingWait = Math.ceil((oneHour - timeSinceLastClaim) / (60 * 1000));
        throw APIError.failedPrecondition(`Please wait ${remainingWait} minutes before claiming again`);
      }
    }

    // In a real implementation, this would mint/transfer SOLF tokens
    // Calculate estimated gas fee
    const estimatedGasFee = 0.001; // 0.001 SOL estimated
    const transactionSignature = generateMockTransactionSignature();

    await using tx = await fairMintDB.begin();

    try {
      // Update claimed amounts
      const newClaimedTge = claimedTge + claimableTge;
      const newClaimedVesting = claimedVesting + claimableVesting;

      await tx.exec`
        UPDATE fair_mint_vesting 
        SET claimed_tge = ${newClaimedTge.toString()}::numeric,
            claimed_vesting = ${newClaimedVesting.toString()}::numeric,
            last_claim_time = ${now},
            updated_at = ${now}
        WHERE id = ${vesting.id}
      `;

      // Record the claim transaction with enhanced details
      await tx.exec`
        INSERT INTO fair_mint_claims (
          event_id, user_wallet, tge_claimed, vesting_claimed, total_claimed,
          transaction_signature, claim_type
        ) VALUES (
          ${req.eventId}, ${req.userWallet}, ${claimableTge.toString()}::numeric, 
          ${claimableVesting.toString()}::numeric, ${totalClaimable.toString()}::numeric,
          ${transactionSignature}, ${req.claimType}
        )
      `;

      const remainingTotalSolf = parseFloat(vesting.totalSolfAllocated);
      const totalClaimed = newClaimedTge + newClaimedVesting;
      const remainingBalance = remainingTotalSolf - totalClaimed;

      // Calculate next claimable date
      const dailyVestingRate = totalVestingAmount / (totalVestingPeriod / (24 * 60 * 60 * 1000));
      const nextClaimableDate = vestingProgress < 1 ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : undefined;

      console.log(`User ${req.userWallet} claimed ${totalClaimable} SOLF tokens (TGE: ${claimableTge}, Vesting: ${claimableVesting})`);

      return {
        success: true,
        transactionSignature,
        claimedTge: claimableTge.toString(),
        claimedVesting: claimableVesting.toString(),
        totalClaimed: totalClaimable.toString(),
        remainingBalance: remainingBalance.toString(),
        nextClaimableDate,
        gasFeePaid: estimatedGasFee.toString()
      };

    } catch (error) {
      console.error("Enhanced claim transaction failed:", error);
      throw error;
    }
  }
);

// Get comprehensive vesting event summary for admin dashboard
export const getVestingEventSummary = api<{ eventId: number }, VestingEventSummary>(
  { expose: true, method: "GET", path: "/fair-mint/vesting/event-summary/:eventId" },
  async (req) => {
    const eventInfo = await fairMintDB.queryRow<{
      eventName: string;
      totalSolfAllocated: string;
    }>`
      SELECT event_name as "eventName", total_solf_allocated as "totalSolfAllocated"
      FROM fair_mint_events 
      WHERE id = ${req.eventId}
    `;

    if (!eventInfo) {
      throw APIError.notFound("Event not found");
    }

    const summary = await fairMintDB.queryRow<{
      totalParticipants: number;
      totalSolfAllocated: string;
      totalTgeClaimed: string;
      totalVestingClaimed: string;
      totalRemainingToVest: string;
      participantsFullyVested: number;
      participantsPartiallyVested: number;
      participantsNotStarted: number;
    }>`
      SELECT 
        COUNT(*) as "totalParticipants",
        COALESCE(SUM(CAST(total_solf_allocated AS NUMERIC)), 0)::TEXT as "totalSolfAllocated",
        COALESCE(SUM(CAST(claimed_tge AS NUMERIC)), 0)::TEXT as "totalTgeClaimed",
        COALESCE(SUM(CAST(claimed_vesting AS NUMERIC)), 0)::TEXT as "totalVestingClaimed",
        COALESCE(SUM(CAST(total_solf_allocated AS NUMERIC) - CAST(claimed_tge AS NUMERIC) - CAST(claimed_vesting AS NUMERIC)), 0)::TEXT as "totalRemainingToVest",
        COUNT(CASE WHEN CAST(claimed_tge AS NUMERIC) + CAST(claimed_vesting AS NUMERIC) >= CAST(total_solf_allocated AS NUMERIC) THEN 1 END) as "participantsFullyVested",
        COUNT(CASE WHEN CAST(claimed_tge AS NUMERIC) + CAST(claimed_vesting AS NUMERIC) > 0 AND CAST(claimed_tge AS NUMERIC) + CAST(claimed_vesting AS NUMERIC) < CAST(total_solf_allocated AS NUMERIC) THEN 1 END) as "participantsPartiallyVested",
        COUNT(CASE WHEN CAST(claimed_tge AS NUMERIC) + CAST(claimed_vesting AS NUMERIC) = 0 THEN 1 END) as "participantsNotStarted"
      FROM fair_mint_vesting 
      WHERE event_id = ${req.eventId}
    `;

    const totalAllocated = parseFloat(summary?.totalSolfAllocated || '0');
    const totalClaimed = parseFloat(summary?.totalTgeClaimed || '0') + parseFloat(summary?.totalVestingClaimed || '0');
    const vestingProgress = totalAllocated > 0 ? (totalClaimed / totalAllocated) * 100 : 0;

    return {
      eventId: req.eventId,
      eventName: eventInfo.eventName,
      totalParticipants: summary?.totalParticipants || 0,
      totalSolfAllocated: summary?.totalSolfAllocated || '0',
      totalTgeClaimed: summary?.totalTgeClaimed || '0',
      totalVestingClaimed: summary?.totalVestingClaimed || '0',
      totalRemainingToVest: summary?.totalRemainingToVest || '0',
      vestingProgress,
      participantsFullyVested: summary?.participantsFullyVested || 0,
      participantsPartiallyVested: summary?.participantsPartiallyVested || 0,
      participantsNotStarted: summary?.participantsNotStarted || 0
    };
  }
);

// Bulk claim processing for admin (emergency function)
export const processBulkClaims = api<{
  eventId: number;
  adminWallet: string;
  claimType: 'tge' | 'vesting' | 'both';
  userWallets?: string[]; // If empty, process all eligible users
}, {
  totalProcessed: number;
  totalClaimed: string;
  errors: Array<{ userWallet: string; error: string }>;
}>(
  { expose: true, method: "POST", path: "/fair-mint/vesting/bulk-claim" },
  async (req) => {
    // Verify admin authorization
    const expectedAdminWallet = adminWalletAddress();
    if (req.adminWallet !== expectedAdminWallet) {
      throw APIError.permissionDenied("Only authorized administrators can process bulk claims");
    }

    let userWallets = req.userWallets;
    if (!userWallets || userWallets.length === 0) {
      // Get all users with claimable amounts
      const allUsers = await fairMintDB.queryAll<{ userWallet: string }>`
        SELECT user_wallet as "userWallet"
        FROM fair_mint_vesting
        WHERE event_id = ${req.eventId}
          AND (
            CAST(tge_amount AS NUMERIC) > CAST(claimed_tge AS NUMERIC) OR
            (NOW() >= vesting_start_time AND 
             CAST(vesting_amount AS NUMERIC) * 
             LEAST(1, EXTRACT(EPOCH FROM (NOW() - vesting_start_time)) / EXTRACT(EPOCH FROM (vesting_end_time - vesting_start_time))) 
             > CAST(claimed_vesting AS NUMERIC))
          )
      `;
      userWallets = allUsers.map(u => u.userWallet);
    }

    let totalProcessed = 0;
    let totalClaimedAmount = 0;
    const errors: Array<{ userWallet: string; error: string }> = [];

    for (const userWallet of userWallets) {
      try {
        const result = await enhancedClaimTokens({
          userWallet,
          eventId: req.eventId,
          claimType: req.claimType
        });

        if (result.success) {
          totalProcessed++;
          totalClaimedAmount += parseFloat(result.totalClaimed);
        }
      } catch (error) {
        errors.push({
          userWallet,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    // Log bulk claim operation
    await fairMintDB.exec`
      INSERT INTO fair_mint_emergency_actions (event_id, action_type, admin_wallet, reason, parameters)
      VALUES (${req.eventId}, 'bulk_claim', ${req.adminWallet}, 'Bulk claim processing', 
              jsonb_build_object('claimType', ${req.claimType}, 'processed', ${totalProcessed}, 'errors', ${errors.length}))
    `;

    return {
      totalProcessed,
      totalClaimed: totalClaimedAmount.toString(),
      errors
    };
  }
);

function generateMockTransactionSignature(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
