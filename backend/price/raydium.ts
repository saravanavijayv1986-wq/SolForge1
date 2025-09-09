import { secret } from "encore.dev/config";
import { APIError } from "encore.dev/api";

const raydiumApiBase = secret("RaydiumApiBase");

export interface RaydiumQuote {
  outAmount: string;
}

// In-memory cache for Raydium quotes to avoid rate limits
const quoteCache = new Map<string, { data: RaydiumQuote, timestamp: number }>();
const CACHE_TTL = 5000; // 5 seconds

export async function quote(inputMint: string, outputMint: string, amount: string): Promise<RaydiumQuote> {
  const cacheKey = `${inputMint}-${outputMint}-${amount}`;
  const cached = quoteCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp < CACHE_TTL)) {
    return cached.data;
  }

  const url = new URL(`${raydiumApiBase()}/v3/amm/compute/swap-base-in`);
  url.searchParams.append("inputMint", inputMint);
  url.searchParams.append("outputMint", outputMint);
  url.searchParams.append("amount", amount);
  url.searchParams.append("slippageBps", "50");
  url.searchParams.append("txVersion", "V0");

  try {
    const res = await fetch(url.toString(), {
      headers: { "accept": "application/json" },
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Raydium compute failed: ${res.status} ${text}`);
    }

    const j = (await res.json()) as {
      success?: boolean;
      data?: { outAmount: string };
      msg?: string;
    };
    if (!j?.success || !j.data) {
      throw new Error(j?.msg || "Raydium compute returned no success or data");
    }

    const quoteData: RaydiumQuote = {
      outAmount: j.data.outAmount,
    };

    quoteCache.set(cacheKey, { data: quoteData, timestamp: Date.now() });
    return quoteData;
  } catch (err) {
    console.error(`Raydium quote request failed for ${url.toString()}:`, err);
    if (err instanceof Error) {
      throw APIError.internal(`Raydium quote failed: ${err.message}`);
    }
    throw APIError.internal("An unknown error occurred while fetching Raydium quote.");
  }
}
