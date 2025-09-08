import { api, APIError } from "encore.dev/api";
import { fairMintDB } from "./db";

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

export interface ClaimableAmount {
  totalAllocated: string;
  tgeAmount: string;
  vestingAmount: string;
  claimedTge: string;
  claimedVesting: string;
  claimableTge: string;
  claimableVesting: string;
  totalClaimable: string;
  vestingProgress: number;
  nextVestingDate?: Date;
  isFullyVested: boolean;
}

export interface ClaimRequest {
  userWallet: string;
  eventId: number;
  claimType: 'tge' | 'vesting' | 'both';
}

export interface ClaimResponse {
  success: boolean;
  transactionSignature: string;
  claimedTge: string;
  claimedVesting: string;
  totalClaimed: string;
  remainingBalance: string;
}

// Creates vesting schedules when fair mint event is finalized
export const createVestingSchedules = api<{ eventId: number; adminWallet: string; solfPerUsdRate: string }, { schedulesCreated: number }>(
  { expose: true, method: "POST", path: "/fair-mint/vesting/create-schedules" },
  async (req) => {
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
      throw APIError.alreadyExists("Event is already finalized");
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
      // Get all user allocations
      const allocations = await tx.queryAll<{
        userWallet: string;
        totalUsdBurned: string;
      }>`
        SELECT user_wallet as "userWallet", total_usd_burned as "totalUsdBurned"
        FROM fair_mint_allocations 
        WHERE event_id = ${req.eventId}
      `;

      let schedulesCreated = 0;
      const vestingStartTime = new Date();
      const vestingEndTime = new Date(vestingStartTime.getTime() + event.vestingDays * 24 * 60 * 60 * 1000);

      for (const allocation of allocations) {
        const totalSolfAllocated = parseFloat(allocation.totalUsdBurned) * solfPerUsd;
        const tgeAmount = totalSolfAllocated * (event.tgePercentage / 100);
        const vestingAmount = totalSolfAllocated - tgeAmount;

        await tx.exec`
          INSERT INTO fair_mint_vesting (
            event_id, user_wallet, total_solf_allocated, tge_amount, vesting_amount,
            vesting_start_time, vesting_end_time
          ) VALUES (
            ${req.eventId}, ${allocation.userWallet}, ${totalSolfAllocated.toString()},
            ${tgeAmount.toString()}, ${vestingAmount.toString()},
            ${vestingStartTime}, ${vestingEndTime}
          )
        `;

        schedulesCreated++;
      }

      // Update event as finalized
      await tx.exec`
        UPDATE fair_mint_events 
        SET is_finalized = true, solf_per_usd_rate = ${req.solfPerUsdRate}, is_active = false
        WHERE id = ${req.eventId}
      `;

      // Update all burns with actual SOLF allocated
      await tx.exec`
        UPDATE fair_mint_burns 
        SET actual_solf_allocated = CAST(usd_value_at_burn AS NUMERIC) * ${solfPerUsd}
        WHERE event_id = ${req.eventId}
      `;

      console.log(`Created ${schedulesCreated} vesting schedules for event ${req.eventId} with rate ${solfPerUsd} SOLF per USD`);

      return { schedulesCreated };

    } catch (error) {
      console.error("Failed to create vesting schedules:", error);
      throw error;
    }
  }
);

// Gets claimable amounts for a user
export const getClaimableAmount = api<{ userWallet: string; eventId: number }, ClaimableAmount>(
  { expose: true, method: "GET", path: "/fair-mint/vesting/claimable/:userWallet" },
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

    const isFullyVested = vestingProgress >= 1;
    const nextVestingDate = isFullyVested ? undefined : new Date(now.getTime() + 24 * 60 * 60 * 1000); // Next day

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
      nextVestingDate,
      isFullyVested
    };
  }
);

// Claims SOLF tokens
export const claimTokens = api<ClaimRequest, ClaimResponse>(
  { expose: true, method: "POST", path: "/fair-mint/vesting/claim" },
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
    }>`
      SELECT id, total_solf_allocated as "totalSolfAllocated", tge_amount as "tgeAmount",
             vesting_amount as "vestingAmount", claimed_tge as "claimedTge",
             claimed_vesting as "claimedVesting", vesting_start_time as "vestingStartTime",
             vesting_end_time as "vestingEndTime"
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
    }

    const totalClaimable = claimableTge + claimableVesting;

    if (totalClaimable <= 0) {
      throw APIError.failedPrecondition("No tokens are currently claimable");
    }

    // In a real implementation, this would mint/transfer SOLF tokens
    // For now, we'll generate a mock transaction signature
    const transactionSignature = generateMockTransactionSignature();

    await using tx = await fairMintDB.begin();

    try {
      // Update claimed amounts
      const newClaimedTge = claimedTge + claimableTge;
      const newClaimedVesting = claimedVesting + claimableVesting;

      await tx.exec`
        UPDATE fair_mint_vesting 
        SET claimed_tge = ${newClaimedTge.toString()},
            claimed_vesting = ${newClaimedVesting.toString()},
            last_claim_time = ${now}
        WHERE id = ${vesting.id}
      `;

      // Record the claim transaction
      await tx.exec`
        INSERT INTO fair_mint_claims (
          event_id, user_wallet, tge_claimed, vesting_claimed, total_claimed,
          transaction_signature, claim_type
        ) VALUES (
          ${req.eventId}, ${req.userWallet}, ${claimableTge.toString()}, 
          ${claimableVesting.toString()}, ${totalClaimable.toString()},
          ${transactionSignature}, ${req.claimType}
        )
      `;

      const remainingTotalSolf = parseFloat(vesting.totalSolfAllocated);
      const totalClaimed = newClaimedTge + newClaimedVesting;
      const remainingBalance = remainingTotalSolf - totalClaimed;

      console.log(`User ${req.userWallet} claimed ${totalClaimable} SOLF tokens (TGE: ${claimableTge}, Vesting: ${claimableVesting})`);

      return {
        success: true,
        transactionSignature,
        claimedTge: claimableTge.toString(),
        claimedVesting: claimableVesting.toString(),
        totalClaimed: totalClaimable.toString(),
        remainingBalance: remainingBalance.toString()
      };

    } catch (error) {
      console.error("Claim transaction failed:", error);
      throw error;
    }
  }
);

// Gets user's vesting schedule and claim history
export const getVestingSchedule = api<{ userWallet: string; eventId: number }, { 
  schedule: VestingSchedule | null; 
  claims: Array<{
    id: number;
    tgeClaimed: string;
    vestingClaimed: string;
    totalClaimed: string;
    transactionSignature: string;
    claimType: string;
    claimTime: Date;
  }>;
}>(
  { expose: true, method: "GET", path: "/fair-mint/vesting/schedule/:userWallet" },
  async (req) => {
    const schedule = await fairMintDB.queryRow<VestingSchedule>`
      SELECT id, event_id as "eventId", user_wallet as "userWallet",
             total_solf_allocated as "totalSolfAllocated", tge_amount as "tgeAmount",
             vesting_amount as "vestingAmount", claimed_tge as "claimedTge",
             claimed_vesting as "claimedVesting", vesting_start_time as "vestingStartTime",
             vesting_end_time as "vestingEndTime", last_claim_time as "lastClaimTime",
             (claimed_tge + claimed_vesting >= total_solf_allocated) as "isFullyClaimed",
             created_at as "createdAt"
      FROM fair_mint_vesting 
      WHERE user_wallet = ${req.userWallet} AND event_id = ${req.eventId}
    `;

    const claims = await fairMintDB.queryAll<{
      id: number;
      tgeClaimed: string;
      vestingClaimed: string;
      totalClaimed: string;
      transactionSignature: string;
      claimType: string;
      claimTime: Date;
    }>`
      SELECT id, tge_claimed as "tgeClaimed", vesting_claimed as "vestingClaimed",
             total_claimed as "totalClaimed", transaction_signature as "transactionSignature",
             claim_type as "claimType", claim_time as "claimTime"
      FROM fair_mint_claims 
      WHERE user_wallet = ${req.userWallet} AND event_id = ${req.eventId}
      ORDER BY claim_time DESC
    `;

    return { schedule, claims };
  }
);

// Admin function to get all vesting schedules for an event
export const getEventVestingSchedules = api<{ eventId: number }, { 
  schedules: VestingSchedule[];
  summary: {
    totalUsers: number;
    totalAllocated: string;
    totalClaimed: string;
    totalRemaining: string;
    averageAllocation: string;
  };
}>(
  { expose: true, method: "GET", path: "/fair-mint/vesting/event/:eventId" },
  async (req) => {
    const schedules = await fairMintDB.queryAll<VestingSchedule>`
      SELECT id, event_id as "eventId", user_wallet as "userWallet",
             total_solf_allocated as "totalSolfAllocated", tge_amount as "tgeAmount",
             vesting_amount as "vestingAmount", claimed_tge as "claimedTge",
             claimed_vesting as "claimedVesting", vesting_start_time as "vestingStartTime",
             vesting_end_time as "vestingEndTime", last_claim_time as "lastClaimTime",
             (claimed_tge + claimed_vesting >= total_solf_allocated) as "isFullyClaimed",
             created_at as "createdAt"
      FROM fair_mint_vesting 
      WHERE event_id = ${req.eventId}
      ORDER BY total_solf_allocated DESC
    `;

    const summary = await fairMintDB.queryRow<{
      totalUsers: number;
      totalAllocated: string;
      totalClaimed: string;
      totalRemaining: string;
      averageAllocation: string;
    }>`
      SELECT 
        COUNT(*) as "totalUsers",
        COALESCE(SUM(CAST(total_solf_allocated AS NUMERIC)), 0)::TEXT as "totalAllocated",
        COALESCE(SUM(CAST(claimed_tge AS NUMERIC) + CAST(claimed_vesting AS NUMERIC)), 0)::TEXT as "totalClaimed",
        COALESCE(SUM(CAST(total_solf_allocated AS NUMERIC) - CAST(claimed_tge AS NUMERIC) - CAST(claimed_vesting AS NUMERIC)), 0)::TEXT as "totalRemaining",
        COALESCE(AVG(CAST(total_solf_allocated AS NUMERIC)), 0)::TEXT as "averageAllocation"
      FROM fair_mint_vesting 
      WHERE event_id = ${req.eventId}
    `;

    return {
      schedules,
      summary: summary || {
        totalUsers: 0,
        totalAllocated: '0',
        totalClaimed: '0',
        totalRemaining: '0',
        averageAllocation: '0'
      }
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
