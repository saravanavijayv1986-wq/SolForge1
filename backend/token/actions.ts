import { api, APIError } from "encore.dev/api";
import { secret } from "encore.dev/config";
import { Connection, PublicKey, Keypair, SystemProgram, Transaction, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getMinimumBalanceForRentExemptMint, createInitializeMintInstruction, MINT_SIZE, TOKEN_PROGRAM_ID, createAssociatedTokenAccountInstruction, getAssociatedTokenAddressSync, createMintToInstruction } from "@solana/spl-token";
import { tokenDB } from "./db";
import { storage } from "~encore/clients";
import type { TokenInfo } from "./types";

const solanaRpcUrl = secret("SolanaRpcUrl");
const adminWalletAddress = secret("AdminWalletAddress");
const TOKEN_CREATION_FEE_SOL = 0.1;

export interface PrepareTokenCreationRequest {
  creatorWallet: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  isMintable: boolean;
}

export interface PrepareTokenCreationResponse {
  transaction: string; // base64 encoded transaction
  mintAddress: string;
}

// Prepares the transaction for creating a new token
export const prepareTokenCreation = api<PrepareTokenCreationRequest, PrepareTokenCreationResponse>(
  { expose: true, method: "POST", path: "/token/prepare-creation" },
  async (req) => {
    // Validate input
    if (!req.name || req.name.trim().length === 0) throw APIError.invalidArgument("Token name is required");
    if (req.name.length > 32) throw APIError.invalidArgument("Token name must be 32 characters or less");
    if (!req.symbol || req.symbol.trim().length === 0) throw APIError.invalidArgument("Token symbol is required");
    if (req.symbol.length > 10) throw APIError.invalidArgument("Token symbol must be 10 characters or less");
    if (req.decimals < 0 || req.decimals > 9) throw APIError.invalidArgument("Decimals must be between 0 and 9");
    const supplyNum = parseFloat(req.supply);
    if (isNaN(supplyNum) || supplyNum <= 0) throw APIError.invalidArgument("Supply must be a positive number");
    if (!req.creatorWallet) throw APIError.invalidArgument("Creator wallet is required");

    const connection = new Connection(solanaRpcUrl(), 'confirmed');
    const creatorPubkey = new PublicKey(req.creatorWallet);
    const adminPubkey = new PublicKey(adminWalletAddress());

    const mintKeypair = Keypair.generate();
    const mintPubkey = mintKeypair.publicKey;

    const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);
    const initialSupply = BigInt(Number(req.supply) * (10 ** req.decimals));

    const creatorATA = getAssociatedTokenAddressSync(mintPubkey, creatorPubkey);

    const transaction = new Transaction().add(
      // Platform fee
      SystemProgram.transfer({
        fromPubkey: creatorPubkey,
        toPubkey: adminPubkey,
        lamports: TOKEN_CREATION_FEE_SOL * LAMPORTS_PER_SOL,
      }),
      // Create Mint Account
      SystemProgram.createAccount({
        fromPubkey: creatorPubkey,
        newAccountPubkey: mintPubkey,
        space: MINT_SIZE,
        lamports: lamportsForMint,
        programId: TOKEN_PROGRAM_ID,
      }),
      // Initialize Mint
      createInitializeMintInstruction(
        mintPubkey,
        req.decimals,
        req.isMintable ? creatorPubkey : null, // Mint Authority
        null // No freeze authority
      ),
      // Create ATA for creator
      createAssociatedTokenAccountInstruction(
        creatorPubkey, creatorATA, creatorPubkey, mintPubkey
      ),
      // Mint initial supply to creator's ATA
      createMintToInstruction(
        mintPubkey, creatorATA, creatorPubkey, initialSupply
      )
    );

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = creatorPubkey;

    // Partially sign with the new mint keypair, as it's a required signer for its own creation
    transaction.partialSign(mintKeypair);

    const serializedTransaction = transaction.serialize({
      requireAllSignatures: false,
    }).toString('base64');

    return {
      transaction: serializedTransaction,
      mintAddress: mintPubkey.toBase58(),
    };
  }
);

export interface FinalizeTokenCreationRequest {
  signedTransaction: string;
  mintAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description?: string;
  logoFile?: string;
  creatorWallet: string;
  isMintable: boolean;
}

export interface FinalizeTokenCreationResponse {
  transactionSignature: string;
  token: TokenInfo;
}

// Executes the signed transaction and records the token
export const finalizeTokenCreation = api<FinalizeTokenCreationRequest, FinalizeTokenCreationResponse>(
  { expose: true, method: "POST", path: "/token/finalize-creation" },
  async (req) => {
    const connection = new Connection(solanaRpcUrl(), 'confirmed');
    
    const signedTx = Buffer.from(req.signedTransaction, 'base64');
    const transactionSignature = await connection.sendRawTransaction(signedTx);

    const latestBlockHash = await connection.getLatestBlockhash('confirmed');
    await connection.confirmTransaction({
        signature: transactionSignature,
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight
    }, 'confirmed');

    // Arweave upload logic
    let imageUrl: string | null = null;
    let imageTransactionId: string | null = null;
    if (req.logoFile) {
      try {
        const imageResponse = await storage.uploadImage({
          imageData: req.logoFile,
          fileName: `${req.symbol.toLowerCase()}-logo.png`,
          contentType: 'image/png'
        });
        imageUrl = imageResponse.imageUrl;
        imageTransactionId = imageResponse.transactionId;
      } catch (error) { 
        console.error("Image upload failed:", error); 
        // Continue without image if upload fails
      }
    }

    let metadataUrl: string | null = null;
    let metadataTransactionId: string | null = null;
    try {
      const metadataResponse = await storage.uploadMetadata({
        name: req.name,
        symbol: req.symbol,
        description: req.description,
        image: imageUrl || undefined,
        decimals: req.decimals,
        supply: req.supply,
        creator: req.creatorWallet,
        attributes: [
          { trait_type: "Mintable", value: req.isMintable ? "Yes" : "No" },
          { trait_type: "Platform", value: "SolForge" }
        ]
      });
      metadataUrl = metadataResponse.metadataUrl;
      metadataTransactionId = metadataResponse.transactionId;
    } catch (error) { 
      console.error("Metadata upload failed:", error); 
      // Continue without metadata URL if upload fails
    }

    // Save to DB
    const token = await tokenDB.queryRow<TokenInfo>`
      INSERT INTO tokens (
        mint_address, name, symbol, decimals, supply, description, 
        logo_url, image_url, metadata_url, image_transaction_id, metadata_transaction_id,
        creator_wallet, total_minted, is_mintable, mint_authority, freeze_authority,
        fee_transaction_signature
      )
      VALUES (
        ${req.mintAddress}, ${req.name}, ${req.symbol}, ${req.decimals}, 
        ${req.supply}, ${req.description || null}, 
        ${imageUrl}, ${imageUrl}, ${metadataUrl}, ${imageTransactionId}, ${metadataTransactionId},
        ${req.creatorWallet}, ${req.supply}, ${req.isMintable}, 
        ${req.isMintable ? req.creatorWallet : null}, null,
        ${transactionSignature}
      )
      RETURNING 
        id, mint_address as "mintAddress", name, symbol, decimals, supply, description, 
        logo_url as "logoUrl", metadata_url as "metadataUrl", creator_wallet as "creatorWallet",
        total_minted as "totalMinted", is_mintable as "isMintable", is_frozen as "isFrozen", 
        created_at as "createdAt"
    `;

    if (!token) {
      throw APIError.internal("Failed to save token to database");
    }

    return { transactionSignature, token };
  }
);
