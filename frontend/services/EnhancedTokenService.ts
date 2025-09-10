import { useCallback } from 'react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { 
  Keypair, 
  SystemProgram, 
  Transaction, 
  PublicKey,
  LAMPORTS_PER_SOL 
} from '@solana/web3.js';
import {
  MINT_SIZE,
  TOKEN_PROGRAM_ID,
  getMinimumBalanceForRentExemption,
  createInitializeMintInstruction,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getAccount,
  TokenAccountNotFoundError,
} from '@solana/spl-token';
import { withRetry, parseSolanaError, formatSolanaError } from '../utils/solana-errors';
import { TOKEN_CREATION_FEE } from '../config';
import backend from '~backend/client';

export interface CreateTokenWithMetadataArgs {
  // Token Info
  name: string;
  symbol: string;
  decimals: number;
  
  // Supply Settings
  initialSupply: number;
  maxSupply?: number;
  lockMintAuthority?: boolean;
  
  // Authorities
  isBurnable: boolean;
  hasFreezeAuthority: boolean;
  
  // Metadata
  description?: string;
  logoFile?: File;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
}

export interface TokenCreationResult {
  mint: string;
  signature: string;
  ata?: string;
  metadataUrl?: string;
}

export function useEnhancedTokenService() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const createTokenWithMetadata = useCallback(
    async (args: CreateTokenWithMetadataArgs): Promise<TokenCreationResult> => {
      if (!publicKey) throw new Error('Wallet not connected');

      try {
        // 1. Check wallet balance
        const balance = await withRetry(async () => {
          return await connection.getBalance(publicKey);
        }, 3, 1000);

        const balanceInSol = balance / LAMPORTS_PER_SOL;
        const requiredBalance = TOKEN_CREATION_FEE + 0.05; // Fee + buffer for tx costs

        if (balanceInSol < requiredBalance) {
          throw new Error(`Insufficient SOL balance. Required: ${requiredBalance.toFixed(3)} SOL, Available: ${balanceInSol.toFixed(4)} SOL`);
        }

        // 2. Upload metadata to Arweave if needed
        let metadataUrl: string | undefined;
        let imageTransactionId: string | undefined;

        if (args.logoFile || args.description || args.website || args.twitter || args.telegram || args.discord) {
          try {
            // Upload image first if provided
            let imageUrl: string | undefined;
            if (args.logoFile) {
              const base64Data = await new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result as string);
                reader.readAsDataURL(args.logoFile!);
              });

              const imageResponse = await backend.storage.uploadImage({
                imageData: base64Data,
                fileName: args.logoFile.name,
                contentType: args.logoFile.type,
              });

              imageUrl = imageResponse.imageUrl;
              imageTransactionId = imageResponse.transactionId;
            }

            // Upload metadata JSON
            const metadataResponse = await backend.storage.uploadMetadata({
              name: args.name,
              symbol: args.symbol,
              description: args.description || '',
              image: imageUrl || '',
              decimals: args.decimals,
              supply: args.initialSupply.toString(),
              creator: publicKey.toString(),
              attributes: [
                { trait_type: 'Supply Type', value: args.lockMintAuthority ? 'Fixed' : 'Mintable' },
                { trait_type: 'Burnable', value: args.isBurnable ? 'Yes' : 'No' },
                { trait_type: 'Freezable', value: args.hasFreezeAuthority ? 'Yes' : 'No' },
                ...(args.website ? [{ trait_type: 'Website', value: args.website }] : []),
                ...(args.twitter ? [{ trait_type: 'Twitter', value: args.twitter }] : []),
                ...(args.telegram ? [{ trait_type: 'Telegram', value: args.telegram }] : []),
                ...(args.discord ? [{ trait_type: 'Discord', value: args.discord }] : []),
              ],
            });

            metadataUrl = metadataResponse.metadataUrl;
          } catch (error) {
            console.warn('Metadata upload failed, continuing without metadata:', error);
          }
        }

        // 3. Create the SPL token
        const mintKeypair = Keypair.generate();
        const lamports = await getMinimumBalanceForRentExemption(connection, MINT_SIZE);

        const transaction = new Transaction();

        // Add fee payment to platform
        const platformWallet = new PublicKey("7wBKaVpxKBa31VgY4HBd7xzCu3AxoAzK8LjGr9zn8YxJ"); // Team wallet
        transaction.add(
          SystemProgram.transfer({
            fromPubkey: publicKey,
            toPubkey: platformWallet,
            lamports: Math.floor(TOKEN_CREATION_FEE * LAMPORTS_PER_SOL),
          })
        );

        // Create mint account
        transaction.add(
          SystemProgram.createAccount({
            fromPubkey: publicKey,
            newAccountPubkey: mintKeypair.publicKey,
            space: MINT_SIZE,
            lamports,
            programId: TOKEN_PROGRAM_ID,
          })
        );

        // Initialize mint
        transaction.add(
          createInitializeMintInstruction(
            mintKeypair.publicKey,
            args.decimals,
            publicKey, // Mint Authority
            args.hasFreezeAuthority ? publicKey : null // Freeze Authority
          )
        );

        let ataAddress: string | undefined;

        // Create initial supply if specified
        if (args.initialSupply > 0) {
          const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, publicKey);
          ataAddress = ata.toBase58();

          // Check if ATA exists
          try {
            await getAccount(connection, ata);
          } catch (error: unknown) {
            if (error instanceof TokenAccountNotFoundError) {
              // Create ATA
              transaction.add(
                createAssociatedTokenAccountInstruction(
                  publicKey,
                  ata,
                  publicKey,
                  mintKeypair.publicKey
                )
              );
            } else {
              throw error;
            }
          }

          // Mint initial supply
          const rawAmount = BigInt(Math.round(args.initialSupply * 10 ** args.decimals));
          transaction.add(
            createMintToInstruction(
              mintKeypair.publicKey,
              ata,
              publicKey,
              rawAmount
            )
          );
        }

        // Lock mint authority if fixed supply
        if (args.lockMintAuthority) {
          transaction.add(
            createSetAuthorityInstruction(
              mintKeypair.publicKey,
              publicKey,
              AuthorityType.MintTokens,
              null // Revoke mint authority
            )
          );
        }

        // Send transaction
        const signature = await sendTransaction(transaction, connection, {
          signers: [mintKeypair],
        });

        // Wait for confirmation
        await connection.confirmTransaction({
          signature,
          ...(await connection.getLatestBlockhash())
        }, 'confirmed');

        // 4. Store token in backend database
        try {
          await backend.token.create({
            mintAddress: mintKeypair.publicKey.toBase58(),
            name: args.name,
            symbol: args.symbol,
            decimals: args.decimals,
            supply: args.maxSupply?.toString() || args.initialSupply.toString(),
            description: args.description,
            logoUrl: metadataUrl ? `${metadataUrl}#image` : undefined,
            metadataUrl,
            creatorWallet: publicKey.toString(),
            feeTransactionSignature: signature,
            imageTransactionId,
            metadataTransactionId: metadataUrl ? metadataUrl.split('/').pop() : undefined,
          });
        } catch (error) {
          console.warn('Failed to store token in database:', error);
          // Continue anyway since the token was created successfully
        }

        return {
          mint: mintKeypair.publicKey.toBase58(),
          signature,
          ata: ataAddress,
          metadataUrl,
        };

      } catch (error) {
        console.error('Enhanced token creation failed:', error);
        
        // Parse and format Solana-specific errors
        const solanaError = parseSolanaError(error);
        const formattedError = formatSolanaError(solanaError);
        
        throw new Error(formattedError.description);
      }
    },
    [publicKey, connection, sendTransaction]
  );

  return { createTokenWithMetadata };
}
