import { api, APIError } from "encore.dev/api";
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
    try {
      console.log("Fetching launchpad statistics");

      // Test database connection
      try {
        await launchpadDB.queryRow`SELECT 1 as test`;
        console.log("Launchpad database connection test successful");
      } catch (dbError) {
        console.error("Launchpad database connection test failed:", dbError);
        throw APIError.unavailable("Database is currently unavailable", { originalError: dbError instanceof Error ? dbError.message : String(dbError) });
      }

      // Use simpler query with explicit type casting
      const stats = await launchpadDB.queryRow<{
        totalSolReceived: string;
        totalFeesCollected: string;
        totalSolfDistributed: string;
        totalPurchases: string;
        uniqueWallets: string;
        averagePurchaseSize: string;
        lastPurchaseAt?: Date;
      }>`
        SELECT 
          COALESCE(SUM(sol_sent), 0)::TEXT as "totalSolReceived",
          COALESCE(SUM(fee_paid), 0)::TEXT as "totalFeesCollected",
          COALESCE(SUM(solf_paid), 0)::TEXT as "totalSolfDistributed",
          COUNT(*)::TEXT as "totalPurchases",
          COUNT(DISTINCT wallet)::TEXT as "uniqueWallets",
          COALESCE(AVG(sol_sent), 0)::TEXT as "averagePurchaseSize",
          MAX(created_at) as "lastPurchaseAt"
        FROM launchpad_purchases
      `;

      console.log("Launchpad stats raw result:", stats);

      return {
        totalSolReceived: stats?.totalSolReceived || "0",
        totalFeesCollected: stats?.totalFeesCollected || "0", 
        totalSolfDistributed: stats?.totalSolfDistributed || "0",
        totalPurchases: parseInt(stats?.totalPurchases || "0", 10),
        uniqueWallets: parseInt(stats?.uniqueWallets || "0", 10),
        averagePurchaseSize: stats?.averagePurchaseSize || "0",
        lastPurchaseAt: stats?.lastPurchaseAt || undefined
      };

    } catch (error) {
      console.error("Launchpad stats error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve launchpad statistics", { originalError: error instanceof Error ? error.message : String(error) });
    }
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
    try {
      console.log("Fetching user purchase history for wallet:", req.wallet);

      // Validate input
      if (!req.wallet || typeof req.wallet !== 'string' || req.wallet.trim().length === 0) {
        throw APIError.invalidArgument("Wallet address is required");
      }

      const limit = Math.min(Math.max(req.limit || 20, 1), 100);
      const offset = Math.max(req.offset || 0, 0);
      const cleanWallet = req.wallet.trim();

      // Test database connection
      try {
        await launchpadDB.queryRow`SELECT 1 as test`;
        console.log("Database connection test successful");
      } catch (dbError) {
        console.error("Database connection test failed:", dbError);
        throw APIError.unavailable("Database is currently unavailable", { originalError: dbError instanceof Error ? dbError.message : String(dbError) });
      }

      const [purchases, summary] = await Promise.all([
        launchpadDB.rawQueryAll<PurchaseRecord>(
          `SELECT 
             id,
             wallet,
             sol_sent as "solSent",
             solf_paid as "solfPaid",
             fee_paid as "feePaid",
             tx_sig as "txSig",
             created_at as "createdAt"
           FROM launchpad_purchases 
           WHERE wallet = $1
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          cleanWallet, limit, offset
        ),
        launchpadDB.rawQueryRow<{
          totalSolSpent: string;
          totalSolfReceived: string;
          totalFeesPaid: string;
          purchaseCount: string;
        }>(
          `SELECT 
             COALESCE(SUM(sol_sent), 0)::TEXT as "totalSolSpent",
             COALESCE(SUM(solf_paid), 0)::TEXT as "totalSolfReceived",
             COALESCE(SUM(fee_paid), 0)::TEXT as "totalFeesPaid",
             COUNT(*)::TEXT as "purchaseCount"
           FROM launchpad_purchases 
           WHERE wallet = $1`,
          cleanWallet
        )
      ]);

      console.log(`User history retrieved: ${purchases.length} purchases`);

      return {
        purchases: purchases || [],
        totalSolSpent: summary?.totalSolSpent || "0",
        totalSolfReceived: summary?.totalSolfReceived || "0",
        totalFeesPaid: summary?.totalFeesPaid || "0",
        purchaseCount: parseInt(summary?.purchaseCount || "0", 10)
      };

    } catch (error) {
      console.error("User history error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve user purchase history", { originalError: error instanceof Error ? error.message : String(error) });
    }
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
    try {
      console.log("Fetching recent purchases");

      const limit = Math.min(Math.max(req.limit || 10, 1), 50);
      const offset = Math.max(req.offset || 0, 0);

      // Test database connection
      try {
        await launchpadDB.queryRow`SELECT 1 as test`;
        console.log("Database connection test successful");
      } catch (dbError) {
        console.error("Database connection test failed:", dbError);
        throw APIError.unavailable("Database is currently unavailable", { originalError: dbError instanceof Error ? dbError.message : String(dbError) });
      }

      const [purchases, countResult] = await Promise.all([
        launchpadDB.rawQueryAll<PurchaseRecord>(
          `SELECT 
             id,
             wallet,
             sol_sent as "solSent",
             solf_paid as "solfPaid",
             fee_paid as "feePaid",
             tx_sig as "txSig",
             created_at as "createdAt"
           FROM launchpad_purchases 
           ORDER BY created_at DESC
           LIMIT $1 OFFSET $2`,
          limit, offset
        ),
        launchpadDB.rawQueryRow<{ count: string }>(
          `SELECT COUNT(*)::TEXT as count FROM launchpad_purchases`
        )
      ]);

      console.log(`Recent purchases retrieved: ${purchases.length} purchases`);

      return {
        purchases: purchases || [],
        total: parseInt(countResult?.count || "0", 10)
      };

    } catch (error) {
      console.error("Recent purchases error:", error);
      if (error instanceof APIError) {
        throw error;
      }
      throw APIError.internal("Failed to retrieve recent purchases", { originalError: error instanceof Error ? error.message : String(error) });
    }
  }
);
