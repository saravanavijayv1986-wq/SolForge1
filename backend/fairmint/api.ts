import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { fairMintDB } from "./db";
import { Connection, ParsedInstruction, ParsedTransactionWithMeta } from "@solana/web3.js";
import { z } from "zod";

// ---------- env/secrets ----------
const adminWalletAddress = secret("AdminWalletAddress");
const solanaRpcUrl = secret("SolanaRpcUrl");
const raydiumApiBase = secret("RaydiumApiBase");

// ---------- helpers ----------
const isNumeric = (s: string) => /^-?\d+(\.\d+)?$/.test(s);

async function fetchUsdPriceForMint(mint: string): Promise<number> {
  const RAYDIUM_API = raydiumApiBase();
  // Try TOKEN -> USDC first:
  const quoteBaseIn = async (input: string, output: string, rawAmount: string) => {
    const url = `${RAYDIUM_API}/v3/amm/compute/swap-base-in` +
      `?inputMint=${input}&outputMint=${output}&amount=${rawAmount}` +
      `&slippageBps=50&txVersion=V0`;
    const r = await fetch(url, { headers: { accept: "application/json" }, cache: "no-store" });
    const j = await r.json().catch(() => null);
    if (!j?.success) throw new Error(j?.msg || "raydium compute failed");
    return j.data;
  };

  const USDC = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
  const WSOL = "So11111111111111111111111111111111111111112";

  // 1 TOKEN (assume 6 decimals for quote; exact decimals not critical for ratio since we quote 1 UI token)
  const one = (d: number) => BigInt(Math.round(1 * Math.pow(10, d))).toString();
  try {
    const direct = await quoteBaseIn(mint, USDC, one(6));
    const usdcOut = Number(direct.outAmount) / 1e6;
    if (usdcOut > 0) return usdcOut;
  } catch { /* fallback */ }

  // TOKEN -> SOL -> USDC
  const t2s = await quoteBaseIn(mint, WSOL, one(6));
  const solOut = Number(t2s.outAmount) / 1e9;
  const s2u = await quoteBaseIn(WSOL, USDC, BigInt(1e9).toString());
  const usdcPerSol = Number(s2u.outAmount) / 1e6;
  return solOut * usdcPerSol;
}

function hasBurnForMint(tx: ParsedTransactionWithMeta | null, mint: string): { burned: number, ok: boolean } {
  if (!tx?.transaction?.message?.instructions) return { burned: 0, ok: false };
  let total = 0;
  for (const ix of tx.transaction.message.instructions as ParsedInstruction[]) {
    if (ix.program === "spl-token" && (ix.parsed?.type === "burn" || ix.parsed?.type === "burnChecked")) {
      const info = ix.parsed?.info as any;
      if (info?.mint === mint) {
        const amt = Number(info?.uiAmount || info?.tokenAmount?.uiAmount || 0);
        if (amt > 0) total += amt;
      }
    }
  }
  return { burned: total, ok: total > 0 };
}

// ---------- Schemas ----------
const CreateEventReqSchema = z.object({
  adminWallet: z.string().min(32),
  eventName: z.string().min(3),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  tgePercentage: z.number().int().min(0).max(100),
  vestingDays: z.number().int().min(1).max(365),
  platformFeeBps: z.number().int().min(0).max(1000),
  referralPoolPercentage: z.number().int().min(0).max(20),
  maxPerWalletUsd: z.string().refine(isNumeric),
  maxPerTxUsd: z.string().refine(isNumeric),
  minTxUsd: z.string().refine(isNumeric),
  quoteTtlSeconds: z.number().int().min(1).max(3600).default(60),
  treasuryAddress: z.string().min(32),
  acceptedTokens: z.array(z.object({
    mintAddress: z.string().min(32),
    tokenName: z.string().min(1),
    tokenSymbol: z.string().min(1),
    tokenLogoUrl: z.string().url().optional(),
    dailyCapUsd: z.string().refine(isNumeric),
  })).min(1).max(20)
});

interface AcceptedTokenRequest {
  mintAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  dailyCapUsd: string;
}

interface CreateEventRequest {
  adminWallet: string;
  eventName: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  tgePercentage: number;
  vestingDays: number;
  platformFeeBps: number;
  referralPoolPercentage: number;
  maxPerWalletUsd: string;
  maxPerTxUsd: string;
  minTxUsd: string;
  quoteTtlSeconds: number;
  treasuryAddress: string;
  acceptedTokens: AcceptedTokenRequest[];
}

const BurnReqSchema = z.object({
  eventId: z.number().int().min(1),
  wallet: z.string().min(32),
  mintAddress: z.string().min(32),
  amountUi: z.string().refine(isNumeric),
  txSig: z.string().min(44)
});

interface BurnRequest {
  eventId: number;
  wallet: string;
  mintAddress: string;
  amountUi: string;
  txSig: string;
}

// ---------- API: list events ----------
export interface EventSummary {
  id: number;
  eventName: string;
  description?: string;
  startTime: Date;
  endTime: Date;
  isActive: boolean;
}

interface ListEventsResponse {
  events: EventSummary[];
}

export const listEvents = api<void, ListEventsResponse>(
  { expose: true, method: "GET", path: "/fairmint/events" },
  async () => {
    const rows = await fairMintDB.queryAll<EventSummary>`
      SELECT id, event_name as "eventName", description, start_time as "startTime", end_time as "endTime", is_active as "isActive"
      FROM fair_mint_events
      WHERE is_active = true AND now() BETWEEN start_time AND end_time
      ORDER BY id DESC
    `;
    return { events: rows };
  }
);

// ---------- API: create event (admin) ----------
export const createEvent = api<CreateEventRequest, { eventId: number }>(
  { expose: true, method: "POST", path: "/fairmint/events" },
  async (payload) => {
    const req = CreateEventReqSchema.parse(payload);

    const admin = adminWalletAddress();
    if (req.adminWallet !== admin) {
      throw APIError.permissionDenied("Not authorized.");
    }
    if (req.startTime >= req.endTime) {
      throw APIError.invalidArgument("startTime must be before endTime.");
    }
    if (req.startTime <= new Date()) {
      throw APIError.invalidArgument("startTime must be in the future.");
    }

    await using tx = await fairMintDB.begin();

    await tx.exec`UPDATE fair_mint_events SET is_active = false WHERE is_active = true`;

    const ev = await tx.queryRow<{ id: number }>`
      INSERT INTO fair_mint_events (
        event_name, description, start_time, end_time, is_active,
        tge_percentage, vesting_days, platform_fee_bps,
        max_per_wallet_usd, max_per_tx_usd, quote_ttl_seconds, min_tx_usd,
        treasury_address, referral_pool_percentage
      ) VALUES (
        ${req.eventName},
        ${req.description || null},
        ${req.startTime.toISOString()}::timestamptz,
        ${req.endTime.toISOString()}::timestamptz,
        true,
        ${String(req.tgePercentage)}::integer,
        ${String(req.vestingDays)}::integer,
        ${String(req.platformFeeBps)}::integer,
        ${String(req.maxPerWalletUsd)}::numeric,
        ${String(req.maxPerTxUsd)}::numeric,
        ${String(req.quoteTtlSeconds)}::integer,
        ${String(req.minTxUsd)}::numeric,
        ${req.treasuryAddress},
        ${String(req.referralPoolPercentage)}::integer
      )
      RETURNING id
    `;
    if (!ev) throw APIError.internal("Failed to create event.");

    for (const t of req.acceptedTokens) {
      await tx.exec`
        INSERT INTO fair_mint_accepted_tokens (
          event_id, mint_address, token_name, token_symbol, token_logo_url, daily_cap_usd
        ) VALUES (
          ${ev.id},
          ${t.mintAddress},
          ${t.tokenName.trim()},
          ${t.tokenSymbol.trim().toUpperCase()},
          ${t.tokenLogoUrl || null},
          ${String(t.dailyCapUsd)}::numeric
        )
      `;
    }

    return { eventId: ev.id };
  }
);

// ---------- API: submit burn (verify on-chain) ----------
export const submitBurn = api<BurnRequest, { ok: boolean; usd: string }>(
  { expose: true, method: "POST", path: "/fairmint/burn" },
  async (payload) => {
    const req = BurnReqSchema.parse(payload);
    const conn = new Connection(solanaRpcUrl(), "confirmed");

    const allowed = await fairMintDB.queryRow<{ id: number }>`
      SELECT fme.id
      FROM fair_mint_events fme
      JOIN fair_mint_accepted_tokens fat ON fat.event_id = fme.id AND fat.is_active = true
      WHERE fme.id = ${req.eventId}
        AND fme.is_active = true
        AND now() BETWEEN fme.start_time AND fme.end_time
        AND fat.mint_address = ${req.mintAddress}
      LIMIT 1
    `;
    if (!allowed) throw APIError.invalidArgument("Event or token not active.");

    const tx = await conn.getParsedTransaction(req.txSig, { maxSupportedTransactionVersion: 0 });
    const { ok, burned } = hasBurnForMint(tx, req.mintAddress);
    if (!ok) throw APIError.invalidArgument("Submitted transaction does not contain a valid SPL burn for this mint.");

    const usdPrice = await fetchUsdPriceForMint(req.mintAddress);
    const usdValue = usdPrice * Number(req.amountUi);
    if (!(usdValue > 0)) throw APIError.internal("Price calculation failed.");

    await fairMintDB.exec`
      INSERT INTO fair_mint_burns
        (event_id, wallet, mint_address, amount_raw, usd_value, tx_sig, verified)
      VALUES
        (${req.eventId}, ${req.wallet}, ${req.mintAddress},
         ${String(req.amountUi)}::numeric, ${String(usdValue)}::numeric, ${req.txSig}, true)
      ON CONFLICT (tx_sig) DO NOTHING
    `;

    return { ok: true, usd: usdValue.toFixed(6) };
  }
);

// ---------- API: stats ----------
interface EventStatsParams {
  eventId: number;
}
interface EventStatsResponse {
  totalUsd: string;
  burns: number;
}
export const eventStats = api<EventStatsParams, EventStatsResponse>(
  { expose: true, method: "GET", path: "/fairmint/stats/:eventId" },
  async ({ eventId }) => {
    const row = await fairMintDB.queryRow<{ total: string; cnt: number }>`
      SELECT COALESCE(SUM(usd_value),0)::text AS total, COUNT(*)::int AS cnt
      FROM fair_mint_burns
      WHERE event_id = ${eventId} AND verified = true
    `;
    return { totalUsd: row?.total ?? "0", burns: row?.cnt ?? 0 };
  }
);
