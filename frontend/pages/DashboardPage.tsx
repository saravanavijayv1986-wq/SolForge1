import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Wallet, AlertCircle, Coins, TrendingUp } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { TokenList } from '../components/token/TokenList';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { WalletBalance } from '../components/wallet/WalletBalance';
import { TransferHistory } from '../components/token/TransferHistory';
import { TOKEN_CREATION_FEE, NETWORK_CONFIG } from '../config';

export function DashboardPage() {
  const { connected, publicKey } = useWallet();

  if (!connected) {
    return <WalletConnectPrompt />;
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
              <p className="text-muted-foreground mt-1">
                Manage your SPL tokens and view portfolio on {NETWORK_CONFIG.displayName}
              </p>
            </div>
            <Button asChild className="flex items-center space-x-2">
              <Link to="/create">
                <Plus className="h-4 w-4" />
                <span>Create New Token</span>
              </Link>
            </Button>
          </div>
        </div>

        {/* Wallet Info and Balance */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wallet className="h-5 w-5" />
                  <span>Connected Wallet</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-mono text-sm break-all">{publicKey?.toString()}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Network</p>
                    <p className="text-sm font-medium text-green-600">{NETWORK_CONFIG.displayName}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
          
          <div>
            <WalletBalance />
          </div>
        </div>

        {/* Warning for Mainnet */}
        <Card className="mb-8 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <AlertCircle className="h-5 w-5 text-green-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-green-800 dark:text-green-200">Production Network</h4>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  You are connected to {NETWORK_CONFIG.displayName}. This is the production network. 
                  Tokens created here are real and transactions use real SOL.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Token Management Tabs */}
        <Tabs defaultValue="created" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="created" className="flex items-center space-x-2">
              <Coins className="h-4 w-4" />
              <span>Created Tokens</span>
            </TabsTrigger>
            <TabsTrigger value="holdings" className="flex items-center space-x-2">
              <TrendingUp className="h-4 w-4" />
              <span>Token Holdings</span>
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center space-x-2">
              <Wallet className="h-4 w-4" />
              <span>Transfer History</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="created">
            <Card>
              <CardHeader>
                <CardTitle>Your Created Tokens</CardTitle>
                <CardDescription>
                  SPL tokens you've created and can manage on {NETWORK_CONFIG.displayName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TokenList creatorWallet={publicKey?.toString()} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="holdings">
            <Card>
              <CardHeader>
                <CardTitle>Your Token Holdings</CardTitle>
                <CardDescription>
                  Tokens you own or have received on {NETWORK_CONFIG.displayName}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <TokenList 
                  holderWallet={publicKey?.toString()} 
                  showBalances={true}
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Transfer History</CardTitle>
                <CardDescription>
                  Complete history of all your token transfers
                </CardDescription>
              </CardHeader>
              <CardContent className="flex justify-center">
                <TransferHistory />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
