import { api, APIError } from "encore.dev/api";
import { Query } from "encore.dev/api";
import { tokenDB } from "./db";

export interface GetBalanceRequest {
  mintAddress: string;
  walletAddress: Query<string>;
}

export interface TokenBalance {
  tokenId: number;
  mintAddress: string;
  walletAddress: string;
  balance: string;
  tokenInfo: {
    name: string;
    symbol: string;
    decimals: number;
    logoUrl?: string;
  };
  lastUpdated: Date;
}

export interface GetBalancesRequest {
  walletAddress: Query<string>;
}

export interface GetBalancesResponse {
  balances: TokenBalance[];
  total: number;
}

// Gets the balance of a specific token for a wallet
export const getBalance = api<GetBalanceRequest, TokenBalance>(
  { expose: true, method: "GET", path: "/token/:mintAddress/balance" },
  async (req) => {
    if (!req.walletAddress) {
      throw APIError.invalidArgument("Wallet address is required");
    }

    const balance = await tokenDB.queryRow<TokenBalance>`
      SELECT 
        tb.token_id as "tokenId",
        tb.mint_address as "mintAddress",
        tb.wallet_address as "walletAddress",
        tb.balance,
        tb.last_updated as "lastUpdated",
        jsonb_build_object(
          'name', t.name,
          'symbol', t.symbol,
          'decimals', t.decimals,
          'logoUrl', t.logo_url
        ) as "tokenInfo"
      FROM token_balances tb
      JOIN tokens t ON tb.token_id = t.id
      WHERE tb.mint_address = ${req.mintAddress} AND tb.wallet_address = ${req.walletAddress}
    `;

    if (!balance) {
      throw APIError.notFound("Balance not found for this wallet and token");
    }

    return balance;
  }
);

// Gets all token balances for a wallet
export const getBalances = api<GetBalancesRequest, GetBalancesResponse>(
  { expose: true, method: "GET", path: "/token/balances" },
  async (req) => {
    if (!req.walletAddress) {
      throw APIError.invalidArgument("Wallet address is required");
    }

    const balances = await tokenDB.queryAll<TokenBalance>`
      SELECT 
        tb.token_id as "tokenId",
        tb.mint_address as "mintAddress",
        tb.wallet_address as "walletAddress",
        tb.balance,
        tb.last_updated as "lastUpdated",
        jsonb_build_object(
          'name', t.name,
          'symbol', t.symbol,
          'decimals', t.decimals,
          'logoUrl', t.logo_url
        ) as "tokenInfo"
      FROM token_balances tb
      JOIN tokens t ON tb.token_id = t.id
      WHERE tb.wallet_address = ${req.walletAddress}
        AND tb.balance != '0'
      ORDER BY tb.last_updated DESC
    `;

    return {
      balances,
      total: balances.length
    };
  }
);
