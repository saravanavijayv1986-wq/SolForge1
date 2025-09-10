import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, Wallet, ExternalLink, Shield, Zap } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import { WalletBalance } from '../wallet/WalletBalance';
import { NETWORK_CONFIG, WALLET_INFO } from '../../config';

export function WalletConnectionStep() {
  const { connected, publicKey, wallet } = useWallet();

  const supportedWallets = [
    {
      name: 'Phantom',
      description: 'Most popular Solana wallet',
      features: ['Mobile App', 'Browser Extension', 'Hardware Support'],
      downloadUrl: 'https://phantom.app/',
    },
    {
      name: 'Solflare',
      description: 'Secure multi-platform wallet',
      features: ['Web & Mobile', 'Ledger Support', 'Advanced Features'],
      downloadUrl: 'https://solflare.com/',
    },
    {
      name: 'Backpack',
      description: 'Modern crypto wallet',
      features: ['Multi-chain', 'DeFi Integration', 'NFT Support'],
      downloadUrl: 'https://backpack.app/',
    },
  ];

  if (connected && publicKey) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-3 p-4 bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg">
          <CheckCircle className="h-6 w-6 text-green-500" />
          <div>
            <h3 className="font-medium text-green-800 dark:text-green-200">Wallet Connected</h3>
            <p className="text-sm text-green-600 dark:text-green-400">
              {wallet?.adapter.name} wallet is ready for token creation
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Wallet Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm text-muted-foreground">Wallet</label>
                <p className="font-medium">{wallet?.adapter.name}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Address</label>
                <p className="font-mono text-sm break-all">{publicKey.toString()}</p>
              </div>
              <div>
                <label className="text-sm text-muted-foreground">Network</label>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  {NETWORK_CONFIG.displayName}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <WalletBalance />
        </div>

        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-200">Security Notice</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Make sure you have enough SOL for transaction fees and token creation. 
                  Recommended minimum: {NETWORK_CONFIG.minBalanceForCreation} SOL
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <WalletMultiButton className="!bg-gradient-to-r !from-purple-500 !to-blue-500" />
        <p className="text-sm text-muted-foreground mt-3">
          Connect your Solana wallet to begin creating tokens
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {supportedWallets.map((walletInfo) => (
          <Card key={walletInfo.name} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center justify-between">
                <span>{walletInfo.name}</span>
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </CardTitle>
              <CardDescription>{walletInfo.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm text-muted-foreground mb-4">
                {walletInfo.features.map((feature) => (
                  <li key={feature} className="flex items-center space-x-2">
                    <CheckCircle className="h-3 w-3 text-green-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <a
                href={walletInfo.downloadUrl}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-500" />
            <span>Why Connect a Wallet?</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium">Token Creation</h4>
              <p className="text-muted-foreground">
                Your wallet will be the mint authority and initial owner of the token
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Pay Network Fees</h4>
              <p className="text-muted-foreground">
                SOL is required for transaction fees and rent exemption
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Sign Transactions</h4>
              <p className="text-muted-foreground">
                Approve token creation and metadata uploads securely
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium">Manage Tokens</h4>
              <p className="text-muted-foreground">
                Access your created tokens in the dashboard
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
