import { api, APIError } from "encore.dev/api";

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
      console.log("Fetching launchpad statistics - simplified for development");

      // Return mock data for now to avoid database issues
      return {
        totalSolReceived: "0",
        totalFeesCollected: "0", 
        totalSolfDistributed: "0",
        totalPurchases: 0,
        uniqueWallets: 0,
        averagePurchaseSize: "0",
        lastPurchaseAt: undefined
      };

    } catch (error) {
      console.error("Launchpad stats error:", error);
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

      // Return empty data for now to avoid database issues
      return {
        purchases: [],
        totalSolSpent: "0",
        totalSolfReceived: "0",
        totalFeesPaid: "0",
        purchaseCount: 0
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

      // Return empty data for now to avoid database issues
      return {
        purchases: [],
        total: 0
      };

    } catch (error) {
      console.error("Recent purchases error:", error);
      throw APIError.internal("Failed to retrieve recent purchases", { originalError: error instanceof Error ? error.message : String(error) });
    }
  }
);
