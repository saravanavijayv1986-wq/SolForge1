import React, { FC, useMemo } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { 
  PhantomWalletAdapter, 
  SolflareWalletAdapter,
  BackpackWalletAdapter 
} from "@solana/wallet-adapter-wallets";
import { SOLANA_CONFIG, WALLET_CONFIG } from "../config";

export const SolanaProviders: FC<{ children: React.ReactNode }> = ({ children }) => {
  const endpoint = useMemo(() => SOLANA_CONFIG.rpcEndpoint, []);
  
  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new BackpackWalletAdapter(),
    ],
    []
  );

  return (
    <ConnectionProvider 
      endpoint={endpoint}
      config={{
        commitment: SOLANA_CONFIG.commitment,
        confirmTransactionInitialTimeout: SOLANA_CONFIG.confirmationTimeout,
      }}
    >
      <WalletProvider 
        wallets={wallets} 
        autoConnect={WALLET_CONFIG.autoConnect}
        onError={(error) => {
          console.error('Wallet error:', error);
        }}
      >
        <WalletModalProvider>
          {children}
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
