import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { useQuery } from '@tanstack/react-query';
import { useWallet } from '@solana/wallet-adapter-react';
import { Rocket, Droplets, Lock, TrendingUp, AlertTriangle, Info, ExternalLink, DollarSign, Coins } from 'lucide-react';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';
import type { TokenInfo } from '~backend/token/list';

const steps = [
  { id: 1, name: 'Select Token', description: 'Choose token to launch' },
  { id: 2, name: 'Set Pairing', description: 'SOL or USDC pairing' },
  { id: 3, name: 'Provide Liquidity', description: 'Add tokens and SOL/USDC' },
  { id: 4, name: 'Configure Price', description: 'Set initial token price' },
  { id: 5, name: 'Liquidity Lock', description: 'Optional LP token lock' },
  { id: 6, name: 'Review & Launch', description: 'Confirm and deploy' },
];

interface LaunchConfig {
  selectedToken?: TokenInfo;
  pairing: 'SOL' | 'USDC';
  tokenAmount: string;
  pairAmount: string;
  lockDuration: number; // days
  lockEnabled: boolean;
  initialPrice?: number;
  marketCap?: number;
  liquidityPercent?: number;
}

export function LaunchTokenPage() {
  const { connected, publicKey } = useWallet();
  const { toast } = useToast();
  const [currentStep, setCurrentStep] = useState(1);
  const [config, setConfig] = useState<LaunchConfig>({
    pairing: 'SOL',
    tokenAmount: '',
    pairAmount: '',
    lockDuration: 30,
    lockEnabled: false,
  });

  // Fetch user's created tokens
  const { data: tokens, isLoading } = useQuery({
    queryKey: ['userTokens', publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey) return null;
      const response = await backend.token.list({
        creatorWallet: publicKey.toString(),
        limit: 100,
      });
      return response.tokens.filter(token => !token.isFrozen); // Only non-frozen tokens
    },
    enabled: connected && !!publicKey,
  });

  const updateConfig = (updates: Partial<LaunchConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const calculateMetrics = () => {
    if (!config.selectedToken || !config.tokenAmount || !config.pairAmount) {
      return null;
    }

    const tokenAmt = parseFloat(config.tokenAmount);
    const pairAmt = parseFloat(config.pairAmount);
    
    if (isNaN(tokenAmt) || isNaN(pairAmt) || tokenAmt <= 0 || pairAmt <= 0) {
      return null;
    }

    const price = pairAmt / tokenAmt;
    const totalSupply = parseFloat(config.selectedToken.supply);
    const marketCap = price * totalSupply;
    const liquidityPercent = (tokenAmt / totalSupply) * 100;

    return {
      price,
      marketCap,
      liquidityPercent,
      fdv: marketCap, // Fully diluted valuation
    };
  };

  const metrics = calculateMetrics();
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  if (!connected) {
    return <WalletConnectPrompt />;
  }

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <div>
              <Label>Select Token to Launch</Label>
              <Select
                value={config.selectedToken?.mintAddress || ''}
                onValueChange={(value) => {
                  const token = tokens?.find(t => t.mintAddress === value);
                  updateConfig({ selectedToken: token });
                }}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a token to launch" />
                </SelectTrigger>
                <SelectContent>
                  {tokens?.map((token) => (
                    <SelectItem key={token.id} value={token.mintAddress}>
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                          <span className="text-white font-bold text-xs">
                            {token.symbol.charAt(0)}
                          </span>
                        </div>
                        <div>
                          <div className="font-medium">{token.name}</div>
                          <div className="text-sm text-muted-foreground">{token.symbol}</div>
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {config.selectedToken && (
              <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                      <span className="text-white font-bold">
                        {config.selectedToken.symbol.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg">{config.selectedToken.name}</h3>
                      <div className="flex items-center space-x-2">
                        <Badge variant="secondary">{config.selectedToken.symbol}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {parseFloat(config.selectedToken.supply).toLocaleString()} supply
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {isLoading && (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading your tokens...</p>
              </div>
            )}

            {!isLoading && (!tokens || tokens.length === 0) && (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <CardContent className="pt-6 text-center">
                  <Rocket className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                  <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">
                    No Tokens Found
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300 mb-4">
                    You need to create a token before you can launch it on a DEX.
                  </p>
                  <Button asChild variant="outline">
                    <a href="/create">Create Your First Token</a>
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <div>
              <Label>Choose Trading Pair</Label>
              <div className="grid grid-cols-2 gap-4 mt-2">
                <Card className={`cursor-pointer transition-colors ${
                  config.pairing === 'SOL' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                }`} onClick={() => updateConfig({ pairing: 'SOL' })}>
                  <CardContent className="pt-6 text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-bold">SOL</span>
                    </div>
                    <h3 className="font-medium">SOL Pair</h3>
                    <p className="text-sm text-muted-foreground">Most popular pairing</p>
                  </CardContent>
                </Card>

                <Card className={`cursor-pointer transition-colors ${
                  config.pairing === 'USDC' ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' : ''
                }`} onClick={() => updateConfig({ pairing: 'USDC' })}>
                  <CardContent className="pt-6 text-center">
                    <div className="w-12 h-12 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-2">
                      <span className="text-white font-bold text-xs">USDC</span>
                    </div>
                    <h3 className="font-medium">USDC Pair</h3>
                    <p className="text-sm text-muted-foreground">Stable USD pricing</p>
                  </CardContent>
                </Card>
              </div>
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Pairing Benefits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <h4 className="font-medium mb-2">SOL Pairing</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Higher trading volume potential</li>
                      <li>• Easier for users to access</li>
                      <li>• Lower gas costs for swaps</li>
                      <li>• Solana ecosystem standard</li>
                    </ul>
                  </div>
                  <div>
                    <h4 className="font-medium mb-2">USDC Pairing</h4>
                    <ul className="space-y-1 text-muted-foreground">
                      <li>• Stable USD value reference</li>
                      <li>• Less price volatility</li>
                      <li>• Easier pricing calculations</li>
                      <li>• Institutional preference</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label>Token Amount</Label>
                <Input
                  type="number"
                  placeholder="1000000"
                  value={config.tokenAmount}
                  onChange={(e) => updateConfig({ tokenAmount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Amount of {config.selectedToken?.symbol || 'tokens'} to add to liquidity pool
                </p>
              </div>

              <div className="space-y-2">
                <Label>{config.pairing} Amount</Label>
                <Input
                  type="number"
                  placeholder={config.pairing === 'SOL' ? '100' : '10000'}
                  value={config.pairAmount}
                  onChange={(e) => updateConfig({ pairAmount: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Amount of {config.pairing} to pair with your tokens
                </p>
              </div>
            </div>

            {metrics && (
              <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CardHeader>
                  <CardTitle className="text-lg">Liquidity Preview</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <label className="text-muted-foreground">Initial Price</label>
                      <p className="font-medium text-lg">
                        {metrics.price.toFixed(6)} {config.pairing}
                      </p>
                    </div>
                    <div>
                      <label className="text-muted-foreground">Market Cap</label>
                      <p className="font-medium text-lg">
                        {metrics.marketCap.toLocaleString()} {config.pairing}
                      </p>
                    </div>
                    <div>
                      <label className="text-muted-foreground">Liquidity %</label>
                      <p className="font-medium text-lg">
                        {metrics.liquidityPercent.toFixed(2)}%
                      </p>
                    </div>
                    <div>
                      <label className="text-muted-foreground">Pool Value</label>
                      <p className="font-medium text-lg">
                        {(parseFloat(config.pairAmount) * 2).toFixed(2)} {config.pairing}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-800 dark:text-blue-200">Liquidity Recommendations</h4>
                    <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                      <li>• Provide 5-20% of total supply for healthy trading</li>
                      <li>• Higher liquidity reduces price slippage</li>
                      <li>• Consider your token's long-term value</li>
                      <li>• You'll receive LP tokens representing your share</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            {metrics ? (
              <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <span>Price Configuration</span>
                  </CardTitle>
                  <CardDescription>
                    Your token pricing based on liquidity amounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {metrics.price.toFixed(6)}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {config.pairing} per {config.selectedToken?.symbol}
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {metrics.marketCap.toLocaleString()}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Market Cap ({config.pairing})
                      </div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {metrics.liquidityPercent.toFixed(1)}%
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Supply in Liquidity
                      </div>
                    </div>
                  </div>

                  <Separator className="my-4" />

                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <label className="text-muted-foreground">Pool Composition</label>
                      <div className="mt-1">
                        <p>{parseFloat(config.tokenAmount).toLocaleString()} {config.selectedToken?.symbol}</p>
                        <p>{parseFloat(config.pairAmount).toLocaleString()} {config.pairing}</p>
                      </div>
                    </div>
                    <div>
                      <label className="text-muted-foreground">Total Pool Value</label>
                      <p className="mt-1 font-medium">
                        {(parseFloat(config.pairAmount) * 2).toFixed(2)} {config.pairing}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-orange-500 mx-auto mb-2" />
                  <p className="text-orange-800 dark:text-orange-200">
                    Please configure liquidity amounts in the previous step
                  </p>
                </CardContent>
              </Card>
            )}

            <Card>
              <CardHeader>
                <CardTitle>Price Impact Scenarios</CardTitle>
                <CardDescription>How different trade sizes affect your token price</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                  {metrics && [0.1, 1, 10].map((solAmount) => {
                    const impact = (solAmount / parseFloat(config.pairAmount)) * 100;
                    return (
                      <div key={solAmount} className="p-3 bg-muted rounded-lg">
                        <div className="font-medium">{solAmount} {config.pairing} Trade</div>
                        <div className="text-muted-foreground">
                          ~{impact.toFixed(2)}% price impact
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        );

      case 5:
        return (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Lock className="h-5 w-5" />
                  <span>Liquidity Lock Settings</span>
                </CardTitle>
                <CardDescription>
                  Lock your LP tokens to build trust with your community
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="lockEnabled" className="font-medium">
                      Enable Liquidity Lock
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Lock LP tokens to prevent rug pulls and build community trust
                    </p>
                  </div>
                  <Switch
                    id="lockEnabled"
                    checked={config.lockEnabled}
                    onCheckedChange={(checked) => updateConfig({ lockEnabled: checked })}
                  />
                </div>

                {config.lockEnabled && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Lock Duration</Label>
                      <Select
                        value={config.lockDuration.toString()}
                        onValueChange={(value) => updateConfig({ lockDuration: parseInt(value) })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="30">30 Days</SelectItem>
                          <SelectItem value="90">90 Days</SelectItem>
                          <SelectItem value="180">6 Months</SelectItem>
                          <SelectItem value="365">1 Year</SelectItem>
                          <SelectItem value="730">2 Years</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <Card className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
                      <CardContent className="pt-6">
                        <div className="flex items-start space-x-3">
                          <AlertTriangle className="h-5 w-5 text-yellow-500 mt-0.5" />
                          <div>
                            <h4 className="font-semibold text-yellow-800 dark:text-yellow-200">
                              Liquidity Lock Terms
                            </h4>
                            <ul className="text-sm text-yellow-700 dark:text-yellow-300 mt-1 space-y-1">
                              <li>• LP tokens will be locked for {config.lockDuration} days</li>
                              <li>• You cannot withdraw liquidity during lock period</li>
                              <li>• Lock builds community trust and reduces rug pull risk</li>
                              <li>• This action is irreversible once confirmed</li>
                            </ul>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                )}

                {!config.lockEnabled && (
                  <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
                    <CardContent className="pt-6">
                      <div className="flex items-start space-x-3">
                        <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                        <div>
                          <h4 className="font-semibold text-blue-800 dark:text-blue-200">
                            Why Lock Liquidity?
                          </h4>
                          <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                            <li>• Builds trust with investors and community</li>
                            <li>• Prevents rug pulls and exit scams</li>
                            <li>• Often required by DEX listing platforms</li>
                            <li>• Demonstrates long-term commitment to project</li>
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </CardContent>
            </Card>
          </div>
        );

      case 6:
        return (
          <div className="space-y-6">
            <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Rocket className="h-5 w-5 text-green-500" />
                  <span>Launch Summary</span>
                </CardTitle>
                <CardDescription>
                  Review your token launch configuration
                </CardDescription>
              </CardHeader>
              <CardContent>
                {config.selectedToken && metrics && (
                  <div className="space-y-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-white font-bold text-xl">
                          {config.selectedToken.symbol.charAt(0)}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-2xl font-bold">{config.selectedToken.name}</h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            {config.selectedToken.symbol}
                          </Badge>
                          <span className="text-muted-foreground">
                            / {config.pairing} Pair
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <label className="text-muted-foreground">Initial Price</label>
                        <p className="font-medium text-lg">
                          {metrics.price.toFixed(6)} {config.pairing}
                        </p>
                      </div>
                      <div>
                        <label className="text-muted-foreground">Market Cap</label>
                        <p className="font-medium text-lg">
                          {metrics.marketCap.toLocaleString()} {config.pairing}
                        </p>
                      </div>
                      <div>
                        <label className="text-muted-foreground">Liquidity</label>
                        <p className="font-medium text-lg">
                          {metrics.liquidityPercent.toFixed(1)}% of supply
                        </p>
                      </div>
                      <div>
                        <label className="text-muted-foreground">Lock Duration</label>
                        <p className="font-medium text-lg">
                          {config.lockEnabled ? `${config.lockDuration} days` : 'No lock'}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-medium mb-2">Pool Composition</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>{config.selectedToken.symbol}:</span>
                            <span className="font-medium">
                              {parseFloat(config.tokenAmount).toLocaleString()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>{config.pairing}:</span>
                            <span className="font-medium">
                              {parseFloat(config.pairAmount).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div>
                        <h4 className="font-medium mb-2">Estimated Costs</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Pool Creation:</span>
                            <span className="font-medium">~0.5 SOL</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Transaction Fees:</span>
                            <span className="font-medium">~0.01 SOL</span>
                          </div>
                          {config.lockEnabled && (
                            <div className="flex justify-between">
                              <span>Lock Contract:</span>
                              <span className="font-medium">~0.1 SOL</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {!config.selectedToken || !metrics && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <CardContent className="pt-6 text-center">
                  <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
                  <p className="text-red-800 dark:text-red-200">
                    Please complete all previous steps before launching
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
              <CardContent className="pt-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-orange-800 dark:text-orange-200">
                      Important: DEX Launch Notice
                    </h4>
                    <ul className="text-sm text-orange-700 dark:text-orange-300 mt-1 space-y-1">
                      <li>• This will create a live trading pool on Raydium DEX</li>
                      <li>• Your token will be immediately tradeable by anyone</li>
                      <li>• Liquidity configuration cannot be changed after launch</li>
                      <li>• Make sure you have sufficient {config.pairing} balance</li>
                      <li>• Consider market conditions before launching</li>
                    </ul>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full h-12 text-lg"
              disabled={!config.selectedToken || !metrics}
              onClick={() => {
                toast({
                  title: "DEX Launch Coming Soon",
                  description: "This feature is currently in development. Stay tuned!",
                });
              }}
            >
              <Rocket className="mr-2 h-5 w-5" />
              Launch on DEX
            </Button>
          </div>
        );

      default:
        return <div>Invalid step</div>;
    }
  };

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return !!config.selectedToken;
      case 2:
        return !!config.pairing;
      case 3:
        return !!config.tokenAmount && !!config.pairAmount && !!metrics;
      case 4:
        return !!metrics;
      case 5:
        return true; // Lock is optional
      case 6:
        return !!config.selectedToken && !!metrics;
      default:
        return false;
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Launch Token on DEX</h1>
          <p className="text-muted-foreground">
            Create liquidity pools and make your token tradeable on Raydium
          </p>
        </div>

        {/* Progress */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-foreground">
              Step {currentStep} of {steps.length}
            </span>
            <Badge variant="outline">
              {steps[currentStep - 1]?.name}
            </Badge>
          </div>
          <Progress value={progress} className="w-full" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar - Steps */}
          <div className="lg:col-span-1">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Launch Steps</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {steps.map((step) => (
                    <div
                      key={step.id}
                      className={`flex items-center space-x-3 p-3 rounded-lg transition-colors ${
                        step.id === currentStep
                          ? 'bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800'
                          : step.id < currentStep
                          ? 'bg-green-50 dark:bg-green-950'
                          : 'bg-muted'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        step.id === currentStep
                          ? 'bg-blue-500 text-white'
                          : step.id < currentStep
                          ? 'bg-green-500 text-white'
                          : 'bg-muted-foreground text-muted'
                      }`}>
                        {step.id}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{step.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Live Preview */}
            {config.selectedToken && metrics && (
              <Card className="mt-6">
                <CardHeader>
                  <CardTitle className="text-lg">Live Preview</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {metrics.price.toFixed(6)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {config.pairing} per {config.selectedToken.symbol}
                    </div>
                  </div>
                  <Separator />
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-muted-foreground">Market Cap</span>
                      <p className="font-medium">{metrics.marketCap.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Liquidity</span>
                      <p className="font-medium">{metrics.liquidityPercent.toFixed(1)}%</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Droplets className="h-5 w-5" />
                  <span>{steps[currentStep - 1]?.name}</span>
                </CardTitle>
                <CardDescription>{steps[currentStep - 1]?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {renderStepContent()}

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1}
                  >
                    Previous
                  </Button>

                  {currentStep < steps.length && (
                    <Button
                      onClick={nextStep}
                      disabled={!canProceed()}
                    >
                      Next
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
