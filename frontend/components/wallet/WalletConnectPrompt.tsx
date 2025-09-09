import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletConnectPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
            <CardDescription>
              Please connect your Solana wallet to continue.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex justify-center">
            <WalletMultiButton />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
