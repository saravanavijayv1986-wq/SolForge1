import { api, APIError } from "encore.dev/api";
import { tokenDB } from "./db";

export interface MintTokenRequest {
  mintAddress: string;
  recipientAddress: string;
  amount: string;
  minterWallet: string;
}

export interface MintTokenResponse {
  transactionSignature: string;
  newBalance: string;
  totalMinted: string;
  mintRecord: MintRecord;
}

export interface MintRecord {
  id: number;
  tokenId: number;
  mintAddress: string;
  recipientAddress: string;
  amount: string;
  mintedBy: string;
  transactionSignature: string;
  createdAt: Date;
}

// Mints tokens to a specified address
export const mint = api<MintTokenRequest, MintTokenResponse>(
  { expose: true, method: "POST", path: "/token/mint" },
  async (req) => {
    try {
      // Validate input
      if (!req.mintAddress || req.mintAddress.trim().length === 0) {
        throw APIError.invalidArgument("Mint address is required");
      }
      
      if (!req.recipientAddress || req.recipientAddress.trim().length === 0) {
        throw APIError.invalidArgument("Recipient address is required");
      }
      
      if (!req.minterWallet || req.minterWallet.trim().length === 0) {
        throw APIError.invalidArgument("Minter wallet is required");
      }
      
      const amount = parseFloat(req.amount);
      if (isNaN(amount) || amount <= 0) {
        throw APIError.invalidArgument("Amount must be a positive number");
      }

      // Get token information
      const token = await tokenDB.queryRow<{
        id: number;
        creatorWallet: string;
        name: string;
        symbol: string;
        decimals: number;
        supply: string;
        totalMinted: string;
        isMintable: boolean;
        isFrozen: boolean;
      }>`
        SELECT id, creator_wallet as "creatorWallet", name, symbol, decimals, supply, 
               total_minted as "totalMinted", is_mintable as "isMintable", is_frozen as "isFrozen"
        FROM tokens
        WHERE mint_address = ${req.mintAddress}
      `;

      if (!token) {
        throw APIError.notFound("Token not found");
      }

      // Check if minter has authority (for now, only creator can mint)
      if (token.creatorWallet !== req.minterWallet) {
        throw APIError.permissionDenied("Only the token creator can mint tokens");
      }

      // Check if token is mintable
      if (!token.isMintable) {
        throw APIError.failedPrecondition("Token minting has been disabled");
      }

      // Check if token is frozen
      if (token.isFrozen) {
        throw APIError.failedPrecondition("Token is currently frozen");
      }

      // Check supply limit
      const currentMinted = parseFloat(token.totalMinted);
      const maxSupply = parseFloat(token.supply);
      const newTotalMinted = currentMinted + amount;
      
      if (newTotalMinted > maxSupply) {
        throw APIError.failedPrecondition(`Cannot mint ${amount} tokens. Would exceed maximum supply of ${maxSupply}`);
      }

      // Generate mock transaction signature
      const transactionSignature = generateTransactionSignature();

      // Begin transaction
      await tokenDB.exec`BEGIN`;

      try {
        // Record the mint transaction
        const mintRecord = await tokenDB.queryRow<MintRecord>`
          INSERT INTO token_mints (token_id, mint_address, recipient_address, amount, minted_by, transaction_signature)
          VALUES (${token.id}, ${req.mintAddress}, ${req.recipientAddress}, ${req.amount}::numeric, ${req.minterWallet}, ${transactionSignature})
          RETURNING id, token_id as "tokenId", mint_address as "mintAddress", recipient_address as "recipientAddress", 
                    amount, minted_by as "mintedBy", transaction_signature as "transactionSignature", created_at as "createdAt"
        `;

        if (!mintRecord) {
          throw APIError.internal("Failed to record mint transaction");
        }

        // Update total minted amount
        await tokenDB.exec`
          UPDATE tokens 
          SET total_minted = ${newTotalMinted.toString()}::numeric, updated_at = NOW()
          WHERE id = ${token.id}
        `;

        // Update or create recipient balance
        const existingBalance = await tokenDB.queryRow<{ balance: string }>`
          SELECT balance FROM token_balances 
          WHERE token_id = ${token.id} AND wallet_address = ${req.recipientAddress}
        `;

        const currentBalance = existingBalance ? parseFloat(existingBalance.balance) : 0;
        const newBalance = currentBalance + amount;

        if (existingBalance) {
          await tokenDB.exec`
            UPDATE token_balances 
            SET balance = ${newBalance.toString()}::numeric, last_updated = NOW()
            WHERE token_id = ${token.id} AND wallet_address = ${req.recipientAddress}
          `;
        } else {
          await tokenDB.exec`
            INSERT INTO token_balances (token_id, mint_address, wallet_address, balance)
            VALUES (${token.id}, ${req.mintAddress}, ${req.recipientAddress}, ${newBalance.toString()}::numeric)
          `;
        }

        await tokenDB.exec`COMMIT`;

        return {
          transactionSignature,
          newBalance: newBalance.toString(),
          totalMinted: newTotalMinted.toString(),
          mintRecord
        };

      } catch (error) {
        await tokenDB.exec`ROLLBACK`;
        throw error;
      }

    } catch (error) {
      console.error("Token minting error:", error);
      
      if (error instanceof APIError) {
        throw error;
      }
      
      throw APIError.internal("An unexpected error occurred during token minting");
    }
  }
);

// Helper function to generate a realistic Solana transaction signature
function generateTransactionSignature(): string {
  const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < 88; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}
