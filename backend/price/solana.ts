import { Connection, PublicKey } from "@solana/web3.js";
import { secret } from "encore.dev/config";
import { APIError } from "encore.dev/api";

const solanaRpcUrl = secret("SolanaRpcUrl");
const connection = new Connection(solanaRpcUrl(), { commitment: "confirmed" });

// Cache for mint decimals to reduce RPC calls
const decimalsCache = new Map<string, { decimals: number, timestamp: number }>();
const DECIMALS_CACHE_TTL = 3600 * 1000; // 1 hour, decimals don't change

export async function getMintDecimals(mint: string): Promise<number> {
  const cached = decimalsCache.get(mint);
  if (cached && (Date.now() - cached.timestamp < DECIMALS_CACHE_TTL)) {
    return cached.decimals;
  }

  try {
    const info = await connection.getParsedAccountInfo(new PublicKey(mint));
    if (!info.value) {
      throw new Error("Account not found");
    }
    const data = (info.value as any)?.data?.parsed?.info;
    const decimals = data?.decimals;
    if (typeof decimals !== "number") {
      throw new Error("Unable to read token decimals from account info");
    }
    decimalsCache.set(mint, { decimals, timestamp: Date.now() });
    return decimals;
  } catch (err) {
    console.error(`Failed to get decimals for mint ${mint}:`, err);
    throw APIError.internal(`Failed to get decimals for mint ${mint}`);
  }
}
