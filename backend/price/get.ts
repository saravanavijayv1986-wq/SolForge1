import { api, APIError } from "encore.dev/api";
import { getMintDecimals } from "./solana";
import { quote } from "./raydium";

// Canonical mainnet mints
const USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const WSOL_MINT = "So11111111111111111111111111111111111111112";

interface GetPriceParams {
  mint: string;
}

export interface GetPriceResponse {
  usd: number;
  route: "TOKEN/USDC" | "TOKEN/SOL/USDC" | "not_found";
}

// Gets the USD price for a given SPL token mint.
export const getPrice = api<GetPriceParams, GetPriceResponse>(
  { expose: true, method: "GET", path: "/price/:mint" },
  async ({ mint }) => {
    const TOKEN_MINT = mint;

    if (TOKEN_MINT === USDC_MINT) {
      return { usd: 1, route: "TOKEN/USDC" };
    }

    try {
      // 1. Get decimals for TOKEN, USDC, & WSOL
      const [tokenDec, usdcDec, wsolDec] = await Promise.all([
        getMintDecimals(TOKEN_MINT),
        getMintDecimals(USDC_MINT),
        getMintDecimals(WSOL_MINT),
      ]);

      // 2. Try direct TOKEN -> USDC path
      try {
        const oneTokenRaw = toRaw(1, tokenDec);
        const directQuote = await quote(TOKEN_MINT, USDC_MINT, oneTokenRaw);
        const usdcOut = fromRaw(directQuote.outAmount, usdcDec);

        if (usdcOut > 0) {
          return { usd: usdcOut, route: "TOKEN/USDC" };
        }
      } catch (e) {
        // Ignore error and try the SOL path
        console.log(`Direct quote for ${TOKEN_MINT} -> USDC failed, trying via SOL. Error: ${e instanceof Error ? e.message : String(e)}`);
      }

      // 3. Fallback: TOKEN -> WSOL, then WSOL -> USDC
      // TOKEN -> WSOL (for 1 TOKEN)
      const oneTokenRaw = toRaw(1, tokenDec);
      const tokenToSolQuote = await quote(TOKEN_MINT, WSOL_MINT, oneTokenRaw);
      const solOut = fromRaw(tokenToSolQuote.outAmount, wsolDec);

      if (solOut <= 0) {
        throw new Error("Could not determine TOKEN/SOL price");
      }

      // WSOL -> USDC (for 1 SOL)
      const oneSolRaw = toRaw(1, wsolDec);
      const solToUsdcQuote = await quote(WSOL_MINT, USDC_MINT, oneSolRaw);
      const usdcPerSol = fromRaw(solToUsdcQuote.outAmount, usdcDec);

      if (usdcPerSol <= 0) {
        throw new Error("Could not determine SOL/USDC price");
      }

      const usdPrice = solOut * usdcPerSol;
      if (!(usdPrice > 0)) {
        throw new Error("Computed non-positive USD price");
      }

      return { usd: usdPrice, route: "TOKEN/SOL/USDC" };
    } catch (err: any) {
      console.error(`Failed to compute price for ${mint}:`, err);
      return { usd: 0, route: "not_found" };
    }
  }
);

function toRaw(uiAmount: number, decimals: number): string {
  return BigInt(Math.round(uiAmount * Math.pow(10, decimals))).toString();
}

function fromRaw(rawAmount: string, decimals: number): number {
  return Number(rawAmount) / Math.pow(10, decimals);
}
