import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, ExternalLink, Copy, ArrowRight, Coins, BarChart3, Rocket } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTokenWizard } from '../../providers/TokenWizardProvider';
import { NETWORK_CONFIG } from '../../config';

export function SuccessStep() {
  const { formData, creationResult, resetWizard } = useTokenWizard();
  const { toast } = useToast();

  if (!creationResult) return null;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
    });
  };

  const explorerUrl = `${NETWORK_CONFIG.explorerUrl}/address/${creationResult.mint}`;
  const dexScreenerUrl = `https://dexscreener.com/solana/${creationResult.mint}`;
  
  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        {/* Success Header */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="h-10 w-10 text-green-600 dark:text-green-400" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Token Created Successfully!
          </h1>
          <p className="text-lg text-muted-foreground">
            {formData.symbol} has been deployed to {NETWORK_CONFIG.displayName}
          </p>
        </div>

        {/* Token Details */}
        <Card className="mb-8 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Coins className="h-5 w-5 text-green-600" />
              <span>{formData.name}</span>
            </CardTitle>
            <CardDescription>Your new SPL token is now live on Solana</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4 mb-6">
              {formData.logoUrl ? (
                <div className="w-16 h-16 rounded-lg overflow-hidden border">
                  <img 
                    src={formData.logoUrl} 
                    alt="Token logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
              ) : (
                <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-xl">
                    {formData.symbol?.charAt(0) || 'T'}
                  </span>
                </div>
              )}
              <div>
                <h3 className="text-xl font-bold">{formData.name}</h3>
                <div className="flex items-center space-x-2">
                  <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                    {formData.symbol}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {parseFloat(formData.initialSupply).toLocaleString()} initial supply
                  </span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Mint Address</label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    {creationResult.mint}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(creationResult.mint, 'Mint address')}
                    className="h-auto p-1"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-muted-foreground">Transaction</label>
                <div className="flex items-center space-x-2 mt-1">
                  <code className="bg-muted px-2 py-1 rounded text-xs font-mono">
                    {creationResult.signature.slice(0, 8)}...{creationResult.signature.slice(-8)}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(creationResult.signature, 'Transaction signature')}
                    className="h-auto p-1"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Button
            variant="outline"
            className="h-16 flex flex-col items-center space-y-2"
            onClick={() => window.open(explorerUrl, '_blank')}
          >
            <ExternalLink className="h-5 w-5" />
            <span>View on Solscan</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-16 flex flex-col items-center space-y-2"
            onClick={() => window.open(dexScreenerUrl, '_blank')}
          >
            <BarChart3 className="h-5 w-5" />
            <span>View on DexScreener</span>
          </Button>
          
          <Button
            variant="outline"
            className="h-16 flex flex-col items-center space-y-2"
            onClick={() => {
              const phantomUrl = `https://phantom.app/ul/browse/${creationResult.mint}`;
              window.open(phantomUrl, '_blank');
            }}
          >
            <ExternalLink className="h-5 w-5" />
            <span>Add to Phantom</span>
          </Button>
        </div>

        {/* Next Steps */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
            <CardDescription>
              Here are some recommended next steps for your new token
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <Coins className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Manage Your Token</h4>
                  <p className="text-sm text-muted-foreground">
                    Visit your dashboard to mint additional tokens, manage authorities, and track statistics.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <Rocket className="h-5 w-5 text-purple-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Launch on DEX</h4>
                  <p className="text-sm text-muted-foreground">
                    Create liquidity pools and make your token tradeable on decentralized exchanges.
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3 p-3 bg-muted rounded-lg">
                <BarChart3 className="h-5 w-5 text-green-500 mt-0.5" />
                <div>
                  <h4 className="font-medium">Track Performance</h4>
                  <p className="text-sm text-muted-foreground">
                    Monitor holder counts, trading volume, and market metrics using our analytics tools.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button 
            onClick={resetWizard}
            variant="outline"
            className="flex-1"
          >
            Create Another Token
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/dashboard'}
            className="flex-1 flex items-center justify-center space-x-2"
          >
            <span>Go to Dashboard</span>
            <ArrowRight className="h-4 w-4" />
          </Button>
          
          <Button 
            onClick={() => window.location.href = '/launch'}
            variant="secondary"
            className="flex-1 flex items-center justify-center space-x-2"
          >
            <Rocket className="h-4 w-4" />
            <span>Launch Token</span>
          </Button>
        </div>

        {/* Token Details Summary */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Token Configuration Summary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Supply Type</label>
                <p className="font-medium">
                  {formData.supplyType === 'fixed' ? 'Fixed' : 'Mintable'}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground">Decimals</label>
                <p className="font-medium">{formData.decimals}</p>
              </div>
              <div>
                <label className="text-muted-foreground">Initial Supply</label>
                <p className="font-medium">
                  {parseFloat(formData.initialSupply).toLocaleString()}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground">Network</label>
                <p className="font-medium">{NETWORK_CONFIG.displayName}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
