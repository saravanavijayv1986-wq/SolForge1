import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Wallet, ExternalLink, CheckCircle } from 'lucide-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { WALLET_CONFIG, NETWORK_CONFIG } from '../../config';

export function WalletConnectPrompt() {
  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl w-full space-y-8">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
            <CardDescription>
              Connect your Solana wallet to continue using SolForge on {NETWORK_CONFIG.displayName}
            </CardDescription>
            <div className="flex justify-center mt-4">
              <Badge variant="secondary">
                {NETWORK_CONFIG.displayName}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex justify-center">
              <WalletMultiButton />
            </div>

            {/* Supported Wallets */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
              {Object.entries(WALLET_CONFIG.walletInfo).map(([key, wallet]) => (
                <Card key={key} className="hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center justify-between">
                      <span>{wallet.name}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </CardTitle>
                    <CardDescription className="text-sm">
                      {wallet.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <a
                      href={wallet.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-500 text-sm font-medium inline-flex items-center space-x-1"
                    >
                      <span>Download</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Benefits */}
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="text-lg">Why Connect a Wallet?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Create SPL Tokens</h4>
                        <p className="text-muted-foreground">Deploy your own tokens on Solana</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Manage Token Supply</h4>
                        <p className="text-muted-foreground">Mint, transfer, and manage your tokens</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Buy SOLF Tokens</h4>
                        <p className="text-muted-foreground">Purchase platform tokens via launchpad</p>
                      </div>
                    </div>
                    <div className="flex items-start space-x-2">
                      <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium">Track Portfolio</h4>
                        <p className="text-muted-foreground">Monitor your token holdings and activity</p>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Network Info */}
            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Wallet className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                      Connected to {NETWORK_CONFIG.displayName}
                    </h4>
                    <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                      This is a development network for testing. Transactions use test SOL with no real value.
                      Make sure your wallet is configured for Devnet.
                    </p>
                  </div>
                
