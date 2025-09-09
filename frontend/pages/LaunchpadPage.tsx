import React from 'react';
import { useWallet } from '../providers/WalletProvider';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { WalletBalance } from '../components/wallet/WalletBalance';
import { SOLFPurchaseForm } from '../components/launchpad/SOLFPurchaseForm';
import { LaunchpadStats } from '../components/launchpad/LaunchpadStats';
import { PurchaseHistory } from '../components/launchpad/PurchaseHistory';
import { RecentActivity } from '../components/launchpad/RecentActivity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Rocket, TrendingUp, Shield, Zap } from 'lucide-react';
import { APP_CONFIG, NETWORK_CONFIG } from '../config';

export function LaunchpadPage() {
  const { connected } = useWallet();

  if (!connected) {
    return <WalletConnectPrompt />;
  }

  const features = [
    {
      icon: Zap,
      title: "Instant Distribution",
      description: "Receive SOLF tokens immediately after payment confirmation"
    },
    {
      icon: Shield,
      title: "Secure & Transparent",
      description: "All transactions verified on-chain with complete transparency"
    },
    {
      icon: TrendingUp,
      title: "Fixed Rate",
      description: "Guaranteed 1 SOL = 10,000 SOLF exchange rate"
    }
  ];

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
              <Rocket className="h-8 w-8 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold text-foreground mb-4">
            SOLF Launchpad
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Get SOLF tokens directly with SOL at a fixed rate of 1 SOL = 10,000 SOLF
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Live on {NETWORK_CONFIG.displayName} • Capped supply of 20M SOLF
          </p>
        </div>

        {/* Features */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card key={index}>
                <CardContent className="pt-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          {/* Purchase Form */}
          <div className="lg:col-span-2 space-y-8">
            <SOLFPurchaseForm />
            <PurchaseHistory />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <WalletBalance />
            <RecentActivity />
          </div>
        </div>

        {/* Statistics */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-foreground mb-6 text-center">Launchpad Statistics</h2>
          <LaunchpadStats />
        </div>

        {/* Token Economics */}
        <Card>
          <CardHeader>
            <CardTitle>Token Economics</CardTitle>
            <CardDescription>
              Understanding the SOLF token distribution and utility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold mb-4">Token Distribution</h4>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Supply:</span>
                    <span className="font-medium">20,000,000 SOLF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Treasury (Launchpad):</span>
                    <span className="font-medium">10,000,000 SOLF (50%)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Team & Operations:</span>
                    <span className="font-medium">10,000,000 SOLF (50%)</span>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Exchange Rate:</span>
                    <span className="font-bold">1 SOL = 10,000 SOLF</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Utility & Benefits</h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Staking rewards (coming Q1 2025)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-blue-500 mt-0.5" />
                    <span>Governance voting rights</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-purple-500 mt-0.5" />
                    <span>Launchpad access (≥10K SOLF required)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-orange-500 mt-0.5" />
                    <span>Platform fee revenue sharing</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-red-500 mt-0.5" />
                    <span>Premium features access</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
