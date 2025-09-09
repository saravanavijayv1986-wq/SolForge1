import { api } from "encore.dev/api";
import { launchpadDB } from "./db";

export interface LaunchpadStats {
  totalSolReceived: string;
  totalFeesCollected: string;
  totalSolfDistributed: string;
  totalPurchases: number;
  uniqueWallets: number;
  averagePurchaseSize: string;
  lastPurchaseAt?: Date;
}

// Gets comprehensive launchpad statistics
export const getStats = api<void, LaunchpadStats>(
  { expose: true, method: "GET", path: "/launchpad/stats" },
  async () => {
    const stats = await launchpadDB.queryRow<{
      totalSolReceived: string;
      totalFeesCollected: string;
      totalSolfDistributed: string;
      totalPurchases: number;
      uniqueWallets: number;
      averagePurchaseSize: string;
      lastPurchaseAt?: Date;
    }>`
      SELECT 
        COALESCE(SUM(sol_sent), 0)::TEXT as "totalSolReceived",
        COALESCE(SUM(fee_paid), 0)::TEXT as "totalFeesCollected",
        COALESCE(SUM(solf_paid), 0)::TEXT as "totalSolfDistributed",
        COUNT(*)::INTEGER as "totalPurchases",
        COUNT(DISTINCT wallet)::INTEGER as "uniqueWallets",
        COALESCE(AVG(sol_sent), 0)::TEXT as "averagePurchaseSize",
        MAX(created_at) as "lastPurchaseAt"
      FROM launchpad_purchases
    `;

    return {
      totalSolReceived: stats?.totalSolReceived || "0",
      totalFeesCollected: stats?.totalFeesCollected || "0", 
      totalSolfDistributed: stats?.totalSolfDistributed || "0",
      totalPurchases: stats?.totalPurchases || 0,
      uniqueWallets: stats?.uniqueWallets || 0,
      averagePurchaseSize: stats?.averagePurchaseSize || "0",
      lastPurchaseAt: stats?.lastPurchaseAt || undefined
    };
  }
);

export interface UserPurchaseHistory {
  purchases: PurchaseRecord[];
  totalSolSpent: string;
  totalSolfReceived: string;
  totalFeesPaid: string;
  purchaseCount: number;
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

export interface GetUserHistoryRequest {
  wallet: string;
  limit?: number;
  offset?: number;
}

// Gets purchase history for a specific wallet
export const getUserHistory = api<GetUserHistoryRequest, UserPurchaseHistory>(
  { expose: true, method: "GET", path: "/launchpad/history/:wallet" },
  async (req) => {
    const limit = req.limit || 20;
    const offset = req.offset || 0;

    const [purchases, summary] = await Promise.all([
      launchpadDB.queryAll<PurchaseRecord>`
        SELECT id, wallet, sol_sent as "solSent", solf_paid as "solfPaid", 
               fee_paid as "feePaid", tx_sig as "txSig", created_at as "createdAt"
        FROM launchpad_purchases 
        WHERE wallet = ${req.wallet}
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      launchpadDB.queryRow<{
        totalSolSpent: string;
        totalSolfReceived: string;
        totalFeesPaid: string;
        purchaseCount: number;
      }>`
        SELECT 
          COALESCE(SUM(sol_sent), 0)::TEXT as "totalSolSpent",
          COALESCE(SUM(solf_paid), 0)::TEXT as "totalSolfReceived",
          COALESCE(SUM(fee_paid), 0)::TEXT as "totalFeesPaid",
          COUNT(*)::INTEGER as "purchaseCount"
        FROM launchpad_purchases 
        WHERE wallet = ${req.wallet}
      `
    ]);

    return {
      purchases,
      totalSolSpent: summary?.totalSolSpent || "0",
      totalSolfReceived: summary?.totalSolfReceived || "0",
      totalFeesPaid: summary?.totalFeesPaid || "0",
      purchaseCount: summary?.purchaseCount || 0
    };
  }
);

export interface RecentPurchasesResponse {
  purchases: PurchaseRecord[];
  total: number;
}

export interface GetRecentPurchasesRequest {
  limit?: number;
  offset?: number;
}

// Gets recent purchases across all users
export const getRecentPurchases = api<GetRecentPurchasesRequest, RecentPurchasesResponse>(
  { expose: true, method: "GET", path: "/launchpad/recent" },
  async (req) => {
    const limit = req.limit || 10;
    const offset = req.offset || 0;

    const [purchases, countResult] = await Promise.all([
      launchpadDB.queryAll<PurchaseRecord>`
        SELECT id, wallet, sol_sent as "solSent", solf_paid as "solfPaid", 
               fee_paid as "feePaid", tx_sig as "txSig", created_at as "createdAt"
        FROM launchpad_purchases 
        ORDER BY created_at DESC
        LIMIT ${limit} OFFSET ${offset}
      `,
      launchpadDB.queryRow<{ count: number }>`
        SELECT COUNT(*)::INTEGER as count 
        FROM launchpad_purchases
      `
    ]);

    return {
      purchases,
      total: countResult?.count || 0
    };
  }
);
