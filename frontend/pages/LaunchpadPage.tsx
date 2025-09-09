import React from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { WalletBalance } from '../components/wallet/WalletBalance';
import { SOLFPurchaseForm } from '../components/launchpad/SOLFPurchaseForm';
import { LaunchpadStats } from '../components/launchpad/LaunchpadStats';
import { PurchaseHistory } from '../components/launchpad/PurchaseHistory';
import { RecentActivity } from '../components/launchpad/RecentActivity';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Rocket, TrendingUp, Shield, Zap, AlertTriangle, Coins, DollarSign, Users, Target } from 'lucide-react';
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

  const tokenomics = [
    {
      icon: Coins,
      title: "500M Max Supply",
      description: "Hard cap with mint authority revoked permanently",
      value: "Fixed Forever"
    },
    {
      icon: Target,
      title: "Treasury Allocation",
      description: "Dedicated for launchpad rewards and incentives",
      value: "250M SOLF (50%)"
    },
    {
      icon: DollarSign,
      title: "Launchpad Capacity",
      description: "Total SOL that can be exchanged at current rate",
      value: "25,000 SOL"
    },
    {
      icon: Users,
      title: "Community Focused",
      description: "Fair distribution with transparent allocations",
      value: "No Presale"
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
          <div className="flex flex-wrap justify-center items-center gap-4 mt-4">
            <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Live on {NETWORK_CONFIG.displayName}
            </Badge>
            <Badge variant="outline">
              500M Max Supply
            </Badge>
            <Badge variant="outline">
              Mint Authority Revoked
            </Badge>
          </div>
        </div>

        {/* Token Economics Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {tokenomics.map((item, index) => {
            const Icon = item.icon;
            return (
              <Card key={index}>
                <CardContent className="pt-6 text-center">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{item.title}</h3>
                  <p className="text-xl font-bold text-purple-600 dark:text-purple-400 mb-2">{item.value}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>
                </CardContent>
              </Card>
            );
          })}
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

        {/* Important Notice */}
        <Card className="mb-8 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-orange-800 dark:text-orange-200">Limited Treasury Supply</h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  The launchpad is powered by a fixed treasury allocation of 250M SOLF tokens. 
                  At the current rate of 10,000 SOLF per SOL, this provides capacity for 25,000 SOL in total exchanges. 
                  Once the treasury is depleted, the launchpad will no longer be available.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

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

        {/* Updated Token Economics */}
        <Card className="mb-12">
          <CardHeader>
            <CardTitle>SOLF Token Economics</CardTitle>
            <CardDescription>
              Complete breakdown of the 500M SOLF token distribution and utility
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Token Specifications */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center space-x-2">
                  <Shield className="h-4 w-4 text-blue-500" />
                  <span>Token Specifications</span>
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Token Standard:</span>
                    <span className="font-medium">SPL Token (Solana)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Symbol:</span>
                    <span className="font-medium">SOLF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Decimals:</span>
                    <span className="font-medium">9</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Max Supply:</span>
                    <span className="font-medium">500,000,000 SOLF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type:</span>
                    <span className="font-medium text-green-600">Capped Mint</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Mint Authority:</span>
                    <span className="font-medium text-red-600">Permanently Revoked</span>
                  </div>
                </div>
              </div>

              {/* Allocation Breakdown */}
              <div>
                <h4 className="font-semibold mb-4 flex items-center space-x-2">
                  <Target className="h-4 w-4 text-purple-500" />
                  <span>Initial Allocation</span>
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Treasury (Launchpad):</span>
                    <div className="text-right">
                      <span className="font-medium">250,000,000 SOLF</span>
                      <span className="text-xs text-muted-foreground block">(50%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Team & Operations:</span>
                    <div className="text-right">
                      <span className="font-medium">100,000,000 SOLF</span>
                      <span className="text-xs text-muted-foreground block">(20%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Liquidity Pool:</span>
                    <div className="text-right">
                      <span className="font-medium">100,000,000 SOLF</span>
                      <span className="text-xs text-muted-foreground block">(20%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-muted-foreground">Reserve/Partnerships:</span>
                    <div className="text-right">
                      <span className="font-medium">50,000,000 SOLF</span>
                      <span className="text-xs text-muted-foreground block">(10%)</span>
                    </div>
                  </div>
                  <div className="flex justify-between border-t pt-2">
                    <span className="font-medium">Total Supply:</span>
                    <span className="font-bold">500,000,000 SOLF</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Launchpad Mechanics */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold mb-4 flex items-center space-x-2">
                  <Rocket className="h-4 w-4 text-orange-500" />
                  <span>Launchpad Capacity</span>
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Available Treasury:</span>
                    <span className="font-medium">250,000,000 SOLF</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Exchange Rate:</span>
                    <span className="font-medium">10,000 SOLF per SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total SOL Capacity:</span>
                    <span className="font-medium">25,000 SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">USD Capacity (SOL@$100):</span>
                    <span className="font-medium">$2,500,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Platform Fee per TX:</span>
                    <span className="font-medium">0.1 SOL</span>
                  </div>
                </div>
              </div>

              <div>
                <h4 className="font-semibold mb-4 flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <span>Utility & Governance</span>
                </h4>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-start space-x-2">
                    <TrendingUp className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Staking rewards for long-term holders (Q1 2025)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Users className="h-4 w-4 text-blue-500 mt-0.5" />
                    <span>Governance voting on platform parameters</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Rocket className="h-4 w-4 text-purple-500 mt-0.5" />
                    <span>IDO launchpad access (minimum 10,000 SOLF)</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <DollarSign className="h-4 w-4 text-orange-500 mt-0.5" />
                    <span>Revenue sharing from platform fees</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Shield className="h-4 w-4 text-red-500 mt-0.5" />
                    <span>Premium features and analytics access</span>
                  </li>
                </ul>
              </div>
            </div>

            {/* Supply Safeguards */}
            <div className="mt-8 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <h4 className="font-semibold mb-3 flex items-center space-x-2 text-blue-800 dark:text-blue-200">
                <Shield className="h-4 w-4" />
                <span>Supply Security & Transparency</span>
              </h4>
              <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                <li>• Complete 500M supply minted at token creation</li>
                <li>• Mint authority immediately revoked - no new tokens can ever be created</li>
                <li>• All allocation wallets are publicly auditable on Solana Explorer</li>
                <li>• Treasury wallet secured with multi-signature contracts</li>
                <li>• Transparent on-chain distribution tracking</li>
                <li>• Launchpad stops automatically when treasury allocation is depleted</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Rate Adjustment Notice */}
        <Card className="mb-12 border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Dynamic Rate Adjustment</h4>
                <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                  If demand exceeds the current treasury capacity, the exchange rate may be adjusted to ensure 
                  fair distribution. For example, reducing to 5,000 SOLF per SOL would double the capacity to 50,000 SOL. 
                  Any rate changes will be announced in advance and applied to future purchases only.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
