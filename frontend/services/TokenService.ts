"use client";

import { useCallback } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { Keypair, SystemProgram, Transaction } from "@solana/web3.js";
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
} from "@solana/spl-token";

export type CreateTokenArgs = {
  decimals: number;
  initialSupply?: number;
  lockMintAuthority?: boolean;
};

export function useTokenService() {
  const { connection } = useConnection();
  const { publicKey, sendTransaction } = useWallet();

  const createToken = useCallback(
    async ({ decimals, initialSupply, lockMintAuthority }: CreateTokenArgs) => {
      if (!publicKey) throw new Error("Wallet not connected");

      const mintKeypair = Keypair.generate();
      const lamports = await getMinimumBalanceForRentExemption(connection, MINT_SIZE);

      const transaction = new Transaction().add(
        SystemProgram.createAccount({
          fromPubkey: publicKey,
          newAccountPubkey: mintKeypair.publicKey,
          space: MINT_SIZE,
          lamports,
          programId: TOKEN_PROGRAM_ID,
        }),
        createInitializeMintInstruction(
          mintKeypair.publicKey,
          decimals,
          publicKey, // Mint Authority
          publicKey  // Freeze Authority
        )
      );

      let ataAddress: string | undefined;

      if (initialSupply && initialSupply > 0) {
        const ata = await getAssociatedTokenAddress(mintKeypair.publicKey, publicKey);
        ataAddress = ata.toBase58();

        transaction.add(
          createAssociatedTokenAccountInstruction(publicKey, ata, publicKey, mintKeypair.publicKey)
        );

        const rawAmount = BigInt(Math.round(initialSupply * 10 ** decimals));
        transaction.add(
          createMintToInstruction(mintKeypair.publicKey, ata, publicKey, rawAmount)
        );
      }

      if (lockMintAuthority) {
        transaction.add(
          createSetAuthorityInstruction(
            mintKeypair.publicKey,
            publicKey,
            AuthorityType.MintTokens,
            null
          )
        );
      }

      const signature = await sendTransaction(transaction, connection, {
        signers: [mintKeypair],
      });

      await connection.confirmTransaction(signature, "confirmed");

      return {
        mint: mintKeypair.publicKey.toBase58(),
        ata: ataAddress,
        signature,
      };
    },
    [publicKey, connection, sendTransaction]
  );

  return { createToken };
}
