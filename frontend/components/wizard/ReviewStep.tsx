import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader2, CheckCircle, AlertTriangle, ExternalLink, Coins, Lock, Flame, Snowflake } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useToast } from '@/components/ui/use-toast';
import { useTokenWizard } from '../../providers/TokenWizardProvider';
import { TOKEN_CREATION_FEE, NETWORK_CONFIG } from '../../config';
import { useEnhancedTokenService } from '../../services/EnhancedTokenService';

export function ReviewStep() {
  const { publicKey } = useWallet();
  const { formData, setIsCreating, setCreationResult } = useTokenWizard();
  const { createTokenWithMetadata } = useEnhancedTokenService();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleCreateToken = async () => {
    if (!publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to create the token.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setIsCreating(true);

    try {
      const result = await createTokenWithMetadata({
        // Token Info
        name: formData.name,
        symbol: formData.symbol,
        decimals: formData.decimals,
        
        // Supply Settings
        initialSupply: parseFloat(formData.initialSupply),
        maxSupply: formData.maxSupply ? parseFloat(formData.maxSupply) : undefined,
        lockMintAuthority: formData.supplyType === 'fixed',
        
        // Authorities
        isBurnable: formData.isBurnable,
        hasFreezeAuthority: formData.hasFreezeAuthority,
        
        // Metadata
        description: formData.description,
        logoFile: formData.logoFile,
        website: formData.website,
        twitter: formData.twitter,
        telegram: formData.telegram,
        discord: formData.discord,
      });

      setCreationResult(result);

      toast({
        title: "Token Created Successfully!",
        description: `${formData.symbol} has been deployed to ${NETWORK_CONFIG.displayName}`,
      });
    } catch (error) {
      console.error('Token creation failed:', error);
      toast({
        title: "Token Creation Failed",
        description: error instanceof Error ? error.message : "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsCreating(false);
    }
  };

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Token Overview */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-blue-500" />
            <span>Token Overview</span>
          </CardTitle>
          <CardDescription>Review your token configuration before deployment</CardDescription>
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
              <h3 className="text-2xl font-bold">{formData.name}</h3>
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="text-lg px-3 py-1">
                  {formData.symbol}
                </Badge>
                <span className="text-muted-foreground">
                  {formData.decimals} decimals
                </span>
              </div>
            </div>
          </div>

          {formData.description && (
            <p className="text-muted-foreground mb-4">
              {formData.description}
            </p>
          )}

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <label className="text-muted-foreground">Network</label>
              <p className="font-medium">{NETWORK_CONFIG.displayName}</p>
            </div>
            <div>
              <label className="text-muted-foreground">Standard</label>
              <p className="font-medium">SPL Token</p>
            </div>
            <div>
              <label className="text-muted-foreground">Creator</label>
              <p className="font-mono text-xs">
                {publicKey?.toString().slice(0, 4)}...{publicKey?.toString().slice(-4)}
              </p>
            </div>
            <div>
              <label className="text-muted-foreground">Creation Fee</label>
              <p className="font-medium">{TOKEN_CREATION_FEE} SOL</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Supply Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <span>Supply Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="text-muted-foreground">Supply Type</label>
              <div className="flex items-center space-x-2 mt-1">
                {formData.supplyType === 'fixed' ? (
                  <Lock className="h-4 w-4 text-blue-500" />
                ) : (
                  <Coins className="h-4 w-4 text-green-500" />
                )}
                <span className="font-medium">
                  {formData.supplyType === 'fixed' ? 'Fixed Supply' : 'Mintable Supply'}
                </span>
              </div>
            </div>
            <div>
              <label className="text-muted-foreground">Initial Supply</label>
              <p className="font-medium text-lg">
                {formatNumber(formData.initialSupply)} {formData.symbol}
              </p>
            </div>
            {formData.supplyType === 'mintable' && (
              <div>
                <label className="text-muted-foreground">Maximum Supply</label>
                <p className="font-medium text-lg">
                  {formData.maxSupply ? formatNumber(formData.maxSupply) : 'Unlimited'} {formData.symbol}
                </p>
              </div>
            )}
          </div>

          <Separator className="my-4" />

          <div>
            <label className="text-muted-foreground">Token Authorities</label>
            <div className="flex items-center space-x-4 mt-2">
              {formData.isBurnable && (
                <div className="flex items-center space-x-1">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span className="text-sm">Burnable</span>
                </div>
              )}
              {formData.hasFreezeAuthority && (
                <div className="flex items-center space-x-1">
                  <Snowflake className="h-4 w-4 text-blue-500" />
                  <span className="text-sm">Freezable</span>
                </div>
              )}
              {!formData.isBurnable && !formData.hasFreezeAuthority && (
                <span className="text-sm text-muted-foreground">No additional authorities</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Metadata & Social Links */}
      {(formData.website || formData.twitter || formData.telegram || formData.discord) && (
        <Card>
          <CardHeader>
            <CardTitle>Links & Social Media</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              {formData.website && (
                <div>
                  <label className="text-muted-foreground">Website</label>
                  <a 
                    href={formData.website} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="font-medium text-blue-600 hover:text-blue-500 flex items-center space-x-1"
                  >
                    <span>Visit Site</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              )}
              {formData.twitter && (
                <div>
                  <label className="text-muted-foreground">Twitter</label>
                  <p className="font-medium">@{formData.twitter}</p>
                </div>
              )}
              {formData.telegram && (
                <div>
                  <label className="text-muted-foreground">Telegram</label>
                  <p className="font-medium">@{formData.telegram}</p>
                </div>
              )}
              {formData.discord && (
                <div>
                  <label className="text-muted-foreground">Discord</label>
                  <p className="font-medium">{formData.discord}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>Cost Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span>Token Creation Fee</span>
              <span className="font-medium">{TOKEN_CREATION_FEE} SOL</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Network Transaction Fees</span>
              <span>~0.01 SOL</span>
            </div>
            {formData.logoFile && (
              <div className="flex justify-between text-muted-foreground">
                <span>Arweave Metadata Storage</span>
                <span>Included</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-medium text-lg">
              <span>Total Estimated Cost</span>
              <span>{(TOKEN_CREATION_FEE + 0.01).toFixed(2)} SOL</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Deployment Warning */}
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-orange-800 dark:text-orange-200">
                Important: Production Deployment
              </h4>
              <ul className="text-sm text-orange-700 dark:text-orange-300 mt-1 space-y-1">
                <li>• This will deploy a real token on {NETWORK_CONFIG.displayName}</li>
                <li>• Token configuration cannot be changed after creation</li>
                <li>• Make sure all details are correct before proceeding</li>
                <li>• You will be the initial mint authority and owner</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Create Button */}
      <Card>
        <CardContent className="pt-6">
          <Button
            onClick={handleCreateToken}
            disabled={isSubmitting || !publicKey}
            className="w-full h-12 text-lg"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Creating Token...
              </>
            ) : (
              <>
                <Coins className="mr-2 h-5 w-5" />
                Deploy {formData.symbol} Token
              </>
            )}
          </Button>
          <p className="text-center text-sm text-muted-foreground mt-3">
            By creating this token, you agree to our terms of service and confirm all information is accurate.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
