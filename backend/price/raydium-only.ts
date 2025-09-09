import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Connection, PublicKey } from "@solana/web3.js";

const solanaRpcUrl = secret("SolanaRpcUrl");
const raydiumApiBase = secret("RaydiumApiBase");

export interface RaydiumPriceQuote {
  mint: string;
  usd: number;
  route: string;
  confidence: number;
  timestamp: Date;
  source: "RAYDIUM_DIRECT" | "RAYDIUM_SOL_ROUTE";
}

interface RaydiumSwapResponse {
  success: boolean;
  data: {
    outAmount: string;
    priceImpactPct: number;
    marketInfos: Array<{
      id: string;
      label: string;
      inputMint: string;
      outputMint: string;
    }>;
  };
  msg?: string;
}

// Cache for price data to avoid excessive API calls
const priceCache = new Map<string, { price: RaydiumPriceQuote; timestamp: number }>();
const PRICE_CACHE_TTL = 15000; // 15 seconds for live pricing

// Canonical mainnet mints
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

// Gets price data exclusively from Raydium with comprehensive error handling
export const getRaydiumOnlyPrice = api<{ mint: string }, RaydiumPriceQuote>(
  { expose: true, method: "GET", path: "/pricing/raydium-only/:mint" },
  async ({ mint }) => {
    try {
      // Check cache first
      const cached = priceCache.get(mint);
      if (cached && (Date.now() - cached.timestamp < PRICE_CACHE_TTL)) {
        return cached.price;
      }

      // USDC is always $1
      if (mint === USDC_MINT) {
        const quote: RaydiumPriceQuote = {
          mint,
          usd: 1.0,
          route: "USDC/DIRECT",
          confidence: 100,
          timestamp: new Date(),
          source: "RAYDIUM_DIRECT"
        };
        priceCache.set(mint, { price: quote, timestamp: Date.now() });
        return quote;
      }

      const connection = new Connection(solanaRpcUrl(), 'confirmed');
      
      // Get token decimals
      const tokenDecimals = await getMintDecimals(connection, mint);
      const usdcDecimals = await getMintDecimals(connection, USDC_MINT);
      const wsolDecimals = await getMintDecimals(connection, WSOL_MINT);

      let usdPrice = 0;
      let route = "";
      let confidence = 0;
      let source: "RAYDIUM_DIRECT" | "RAYDIUM_SOL_ROUTE" = "RAYDIUM_DIRECT";

      try {
        // Try direct TOKEN/USDC route first
        const directPrice = await getRaydiumDirectPrice(mint, USDC_MINT, tokenDecimals, usdcDecimals);
        if (directPrice > 0) {
          usdPrice = directPrice;
          route = "TOKEN/USDC";
          confidence = 95;
          source = "RAYDIUM_DIRECT";
        }
      } catch (error) {
        console.log(`Direct TOKEN/USDC route failed for ${mint}, trying SOL route:`, error);
      }

      // If direct route failed, try TOKEN -> SOL -> USDC
      if (usdPrice === 0) {
        try {
          const tokenToSolPrice = await getRaydiumDirectPrice(mint, WSOL_MINT, tokenDecimals, wsolDecimals);
          if (tokenToSolPrice > 0) {
            const solToUsdcPrice = await getRaydiumDirectPrice(WSOL_MINT, USDC_MINT, wsolDecimals, usdcDecimals);
            if (solToUsdcPrice > 0) {
              usdPrice = tokenToSolPrice * solToUsdcPrice;
              route = "TOKEN/SOL/USDC";
              confidence = 85;
              source = "RAYDIUM_SOL_ROUTE";
            }
          }
        } catch (error) {
          console.error(`SOL route failed for ${mint}:`, error);
        }
      }

      if (usdPrice <= 0) {
        throw APIError.notFound(`No Raydium price route found for token ${mint}`);
      }

      const quote: RaydiumPriceQuote = {
        mint,
        usd: usdPrice,
        route,
        confidence,
        timestamp: new Date(),
        source
      };

      // Cache the result
      priceCache.set(mint, { price: quote, timestamp: Date.now() });
      
      return quote;
    } catch (error) {
      console.error(`Failed to get Raydium price for ${mint}:`, error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal(`Failed to fetch price from Raydium: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
);

async function getRaydiumDirectPrice(
  inputMint: string, 
  outputMint: string, 
  inputDecimals: number, 
  outputDecimals: number
): Promise<number> {
  const oneTokenRaw = Math.pow(10, inputDecimals).toString();
  
  const url = new URL(`${raydiumApiBase()}/v3/amm/compute/swap-base-in`);
  url.searchParams.append("inputMint", inputMint);
  url.searchParams.append("outputMint", outputMint);
  url.searchParams.append("amount", oneTokenRaw);
  url.searchParams.append("slippageBps", "50");
  url.searchParams.append("txVersion", "V0");

  const response = await fetch(url.toString(), {
    headers: { 
      "accept": "application/json",
      "User-Agent": "SolForge/1.0"
    },
    timeout: 8000
  });

  if (!response.ok) {
    throw new Error(`Raydium API error: ${response.status} ${response.statusText}`);
  }

  const data: RaydiumSwapResponse = await response.json();
  
  if (!data.success || !data.data || !data.data.outAmount) {
    throw new Error(`Invalid response from Raydium API: ${data.msg || 'Unknown error'}`);
  }

  const outAmount = parseFloat(data.data.outAmount);
  return outAmount / Math.pow(10, outputDecimals);
}

async function getMintDecimals(connection: Connection, mint: string): Promise<number> {
  try {
    const mintInfo = await connection.getParsedAccountInfo(new PublicKey(mint));
    
    if (!mintInfo.value?.data || !('parsed' in mintInfo.value.data)) {
      throw new Error(`Unable to fetch mint info for ${mint}`);
    }
    
    const decimals = (mintInfo.value.data as any).parsed.info.decimals;
    
    if (typeof decimals !== 'number') {
      throw new Error(`Invalid decimals data for mint ${mint}`);
    }
    
    return decimals;
  } catch (error) {
    console.error(`Error getting decimals for mint ${mint}:`, error);
    // Return common defaults
    if (mint === USDC_MINT) return 6;
    if (mint === WSOL_MINT) return 9;
    return 6; // Default fallback
  }
}

// Batch price fetching for multiple tokens
export const getBatchRaydiumPrices = api<{ mints: string[] }, { prices: RaydiumPriceQuote[]; errors: string[] }>(
  { expose: true, method: "POST", path: "/pricing/raydium-only/batch" },
  async ({ mints }) => {
    if (!mints || mints.length === 0) {
      throw APIError.invalidArgument("Mints array cannot be empty");
    }

    if (mints.length > 10) {
      throw APIError.invalidArgument("Maximum 10 mints allowed per batch request");
    }

    const prices: RaydiumPriceQuote[] = [];
    const errors: string[] = [];

    await Promise.allSettled(
      mints.map(async (mint) => {
        try {
          const price = await getRaydiumOnlyPrice({ mint });
          prices.push(price);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`${mint}: ${errorMsg}`);
        }
      })
    );

    return { prices, errors };
  }
);

// Health check endpoint for Raydium-only pricing
export const raydiumHealthCheck = api<void, { status: string; raydiumApiHealthy: boolean; lastUpdate: Date; cacheSize: number }>(
  { expose: true, method: "GET", path: "/pricing/raydium-only/health" },
  async () => {
    let raydiumApiHealthy = false;
    
    try {
      // Test Raydium API with SOL/USDC price check
      const testPrice = await getRaydiumDirectPrice(WSOL_MINT, USDC_MINT, 9, 6);
      raydiumApiHealthy = testPrice > 0;
    } catch (error) {
      console.error("Raydium API health check failed:", error);
    }

    return {
      status: raydiumApiHealthy ? "healthy" : "degraded",
      raydiumApiHealthy,
      lastUpdate: new Date(),
      cacheSize: priceCache.size
    };
  }
);

// Clear pricing cache
export const clearPriceCache = api<void, { cleared: number }>(
  { expose: true, method: "POST", path: "/pricing/raydium-only/clear-cache" },
  async () => {
    const size = priceCache.size;
    priceCache.clear();
    return { cleared: size };
  }
);
