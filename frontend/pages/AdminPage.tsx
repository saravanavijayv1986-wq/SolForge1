import React from 'react';
import { useWallet } from '../providers/WalletProvider';
import { CreateFairMintForm } from '../components/admin/CreateFairMintForm';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { ADMIN_WALLET_ADDRESS } from '../config';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield, Info, CheckCircle } from 'lucide-react';

export function AdminPage() {
  const { connected, publicKey } = useWallet();

  if (!connected) {
    return <WalletConnectPrompt />;
  }

  const isAdmin = publicKey?.toString() === ADMIN_WALLET_ADDRESS;

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>Access Denied</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>You are not authorized to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
            <Shield className="h-8 w-8 text-purple-500" />
            <span>Fair Mint Admin Panel</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage Proof-of-Burn Fair Mint events with SPL token burning.
          </p>
        </div>

        {/* Admin Guidelines */}
        <Card className="mb-8 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-blue-800 dark:text-blue-200">
              <Info className="h-5 w-5" />
              <span>Fair Mint Launch Guidelines</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Core Requirements</h4>
                <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Only curated SPL tokens (no LP tokens)</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>True burns via SPL Token Program</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Pyth price feeds with DEX fallback</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Quote TTL enforcement (90s default)</span>
                  </div>
                </div>
              </div>
              
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Safety Features</h4>
                <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Per-transaction & per-wallet caps</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Daily caps per token type</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>Pause switch for anomalies</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-4 w-4 text-blue-500" />
                    <span>On-chain event transparency</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-blue-200 dark:border-blue-700 pt-4">
              <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Default Launch Parameters</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs text-blue-700 dark:text-blue-300">
                <div>
                  <strong>Window:</strong> 72 hours
                </div>
                <div>
                  <strong>Quote TTL:</strong> 90 seconds
                </div>
                <div>
                  <strong>Max per TX:</strong> $2,500
                </div>
                <div>
                  <strong>Max per wallet:</strong> $5,000
                </div>
                <div>
                  <strong>Daily cap:</strong> $250k per token
                </div>
                <div>
                  <strong>Min burn:</strong> $20
                </div>
                <div>
                  <strong>Platform fee:</strong> 1.5%
                </div>
                <div>
                  <strong>Vesting:</strong> 20% TGE, 80% / 30d
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Safety Checklist */}
        <Card className="mb-8 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-amber-800 dark:text-amber-200">
              <AlertTriangle className="h-5 w-5" />
              <span>Pre-Launch Safety Checklist</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-amber-700 dark:text-amber-300">
              <div className="space-y-2">
                <div>☐ All SPL tokens verified and curated (no LP tokens)</div>
                <div>☐ Pyth price feeds active for all tokens</div>
                <div>☐ DEX TWAP fallback configured (5-min)</div>
                <div>☐ Quote TTL enforced (expires rejected)</div>
                <div>☐ Treasury address set and verified</div>
              </div>
              <div className="space-y-2">
                <div>☐ All caps enforced with clear error messages</div>
                <div>☐ Sub-$20 burns blocked</div>
                <div>☐ Pause switch functional for anomalies</div>
                <div>☐ Terms URL and FAQ content ready</div>
                <div>☐ Finalize logic: SOLF per $1 + 1.5% fee</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <CreateFairMintForm />
      </div>
    </div>
  );
}
