import { api, APIError } from "encore.dev/api";
import { tokenDB } from "./db";

export interface TransferTokenRequest {
  mintAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  transactionSignature: string; // Proof of transfer
}

export interface TransferTokenResponse {
  success: boolean;
  transfer: {
    id: number;
    mintAddress: string;
    fromAddress: string;
    toAddress: string;
    amount: string;
    transactionSignature: string;
    createdAt: Date;
  };
  newFromBalance: string;
  newToBalance: string;
}

export interface GetTransferHistoryRequest {
  mintAddress?: string;
  walletAddress: string;
  limit?: number;
  offset?: number;
}

export interface GetTransferHistoryResponse {
  transfers: TransferRecord[];
  total: number;
  hasMore: boolean;
}

export interface TransferRecord {
  id: number;
  tokenId: number;
  mintAddress: string;
  fromAddress: string;
  toAddress: string;
  amount: string;
  transactionSignature: string;
  direction: 'sent' | 'received';
  tokenInfo: {
    name: string;
    symbol: string;
    decimals: number;
    logoUrl?: string;
  };
  createdAt: Date;
}

// Records a token transfer (called after successful on-chain transfer)
export const recordTransfer = api<TransferTokenRequest, TransferTokenResponse>(
  { expose: true, method: "POST", path: "/token/transfer" },
  async (req) => {
    try {
      // Validate input
      if (!req.mintAddress || req.mintAddress.trim().length === 0) {
        throw APIError.invalidArgument("Mint address is required");
      }
      
      if (!req.fromAddress || req.fromAddress.trim().length === 0) {
        throw APIError.invalidArgument("From address is required");
      }
      
      if (!req.toAddress || req.toAddress.trim().length === 0) {
        throw APIError.invalidArgument("To address is required");
      }
      
      if (!req.transactionSignature || req.transactionSignature.trim().length === 0) {
        throw APIError.invalidArgument("Transaction signature is required");
      }
      
      const amount = parseFloat(req.amount);
      if (isNaN(amount) || amount <= 0) {
        throw APIError.invalidArgument("Amount must be a positive number");
      }

      if (req.fromAddress === req.toAddress) {
        throw APIError.invalidArgument("Cannot transfer to the same address");
      }

      // Check if transaction signature already exists
      const existingTransfer = await tokenDB.queryRow<{ id: number }>`
        SELECT id FROM token_transfers 
        WHERE transaction_signature = ${req.transactionSignature}
      `;

      if (existingTransfer) {
        throw APIError.alreadyExists("This transaction has already been recorded");
      }

      // Get token information
      const token = await tokenDB.queryRow<{
        id: number;
        name: string;
        symbol: string;
        decimals: number;
        isFrozen: boolean;
      }>`
        SELECT id, name, symbol, decimals, is_frozen as "isFrozen"
        FROM tokens
        WHERE mint_address = ${req.mintAddress}
      `;

      if (!token) {
        throw APIError.notFound("Token not found");
      }

      // Check if token is frozen
      if (token.isFrozen) {
        throw APIError.failedPrecondition("Token is currently frozen and cannot be transferred");
      }

      // Begin transaction
      await tokenDB.exec`BEGIN`;

      try {
        // Record the transfer
        const transfer = await tokenDB.queryRow<{
          id: number;
          mintAddress: string;
          fromAddress: string;
          toAddress: string;
          amount: string;
          transactionSignature: string;
          createdAt: Date;
        }>`
          INSERT INTO token_transfers (
            token_id, mint_address, from_address, to_address, amount, transaction_signature
          )
          VALUES (
            ${token.id}, ${req.mintAddress}, ${req.fromAddress}, ${req.toAddress}, 
            ${req.amount}::numeric, ${req.transactionSignature}
          )
          RETURNING 
            id, mint_address as "mintAddress", from_address as "fromAddress", 
            to_address as "toAddress", amount, transaction_signature as "transactionSignature",
            created_at as "createdAt"
        `;

        if (!transfer) {
          throw APIError.internal("Failed to record transfer");
        }

        // Update sender balance
        const fromBalance = await tokenDB.queryRow<{ balance: string }>`
          SELECT balance FROM token_balances 
          WHERE token_id = ${token.id} AND wallet_address = ${req.fromAddress}
        `;

        const currentFromBalance = fromBalance ? parseFloat(fromBalance.balance) : 0;
        const newFromBalance = Math.max(0, currentFromBalance - amount);

        if (fromBalance) {
          await tokenDB.exec`
            UPDATE token_balances 
            SET balance = ${newFromBalance.toString()}::numeric, last_updated = NOW()
            WHERE token_id = ${token.id} AND wallet_address = ${req.fromAddress}
          `;
        } else {
          // This shouldn't happen in a real transfer, but handle gracefully
          await tokenDB.exec`
            INSERT INTO token_balances (token_id, mint_address, wallet_address, balance)
            VALUES (${token.id}, ${req.mintAddress}, ${req.fromAddress}, ${newFromBalance.toString()}::numeric)
          `;
        }

        // Update receiver balance
        const toBalance = await tokenDB.queryRow<{ balance: string }>`
          SELECT balance FROM token_balances 
          WHERE token_id = ${token.id} AND wallet_address = ${req.toAddress}
        `;

        const currentToBalance = toBalance ? parseFloat(toBalance.balance) : 0;
        const newToBalance = currentToBalance + amount;

        if (toBalance) {
          await tokenDB.exec`
            UPDATE token_balances 
            SET balance = ${newToBalance.toString()}::numeric, last_updated = NOW()
            WHERE token_id = ${token.id} AND wallet_address = ${req.toAddress}
          `;
        } else {
          await tokenDB.exec`
            INSERT INTO token_balances (token_id, mint_address, wallet_address, balance)
            VALUES (${token.id}, ${req.mintAddress}, ${req.toAddress}, ${newToBalance.toString()}::numeric)
          `;
        }

        await tokenDB.exec`COMMIT`;

        return {
          success: true,
          transfer,
          newFromBalance: newFromBalance.toString(),
          newToBalance: newToBalance.toString()
        };

      } catch (error) {
        await tokenDB.exec`ROLLBACK`;
        throw error;
      }

    } catch (error) {
      console.error("Token transfer recording error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("An unexpected error occurred during transfer recording");
    }
  }
);

// Gets transfer history for a wallet
export const getTransferHistory = api<GetTransferHistoryRequest, GetTransferHistoryResponse>(
  { expose: true, method: "GET", path: "/token/transfers" },
  async (req) => {
    const limit = req.limit || 20;
    const offset = req.offset || 0;
    
    let query = `
      SELECT 
        tt.id, tt.token_id as "tokenId", tt.mint_address as "mintAddress",
        tt.from_address as "fromAddress", tt.to_address as "toAddress",
        tt.amount, tt.transaction_signature as "transactionSignature",
        tt.created_at as "createdAt",
        CASE 
          WHEN tt.from_address = $1 THEN 'sent'
          ELSE 'received'
        END as direction,
        jsonb_build_object(
          'name', t.name,
          'symbol', t.symbol,
          'decimals', t.decimals,
          'logoUrl', t.logo_url
        ) as "tokenInfo"
      FROM token_transfers tt
      JOIN tokens t ON tt.token_id = t.id
      WHERE (tt.from_address = $1 OR tt.to_address = $1)
    `;
    
    const params: any[] = [req.walletAddress];
    let paramIndex = 2;
    
    // Add mint address filter if specified
    if (req.mintAddress) {
      query += ` AND tt.mint_address = $${paramIndex}`;
      params.push(req.mintAddress);
      paramIndex++;
    }
    
    query += ` ORDER BY tt.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    
    // Count query
    let countQuery = `
      SELECT COUNT(*) as count 
      FROM token_transfers tt 
      WHERE (tt.from_address = $1 OR tt.to_address = $1)
    `;
    
    const countParams = [req.walletAddress];
    if (req.mintAddress) {
      countQuery += ` AND tt.mint_address = $2`;
      countParams.push(req.mintAddress);
    }
    
    const [transfers, countResult] = await Promise.all([
      tokenDB.rawQueryAll<TransferRecord>(query, ...params),
      tokenDB.rawQueryRow<{ count: number }>(countQuery, ...countParams)
    ]);
    
    const total = countResult?.count || 0;
    const hasMore = offset + transfers.length < total;
    
    return {
      transfers,
      total,
      hasMore
    };
  }
);
