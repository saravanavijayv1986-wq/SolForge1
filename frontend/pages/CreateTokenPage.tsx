import React from 'react';
import { useWallet } from '../providers/WalletProvider';
import { CreateTokenForm } from '../components/token/CreateTokenForm';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';

export function CreateTokenPage() {
  const { connected } = useWallet();

  if (!connected) {
    return <WalletConnectPrompt />;
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">Create New Token</h1>
          <p className="text-muted-foreground mt-1">
            Deploy a new SPL token with metadata on Solana Devnet
          </p>
        </div>
        
        <CreateTokenForm />
      </div>
    </div>
  );
}
