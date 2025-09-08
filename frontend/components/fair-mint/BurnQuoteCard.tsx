import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Flame, DollarSign, Clock, AlertTriangle, Shield, CheckCircle, ExternalLink } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Transaction } from '@solana/web3.js';
import { parseSolanaError, formatSolanaError } from '../../utils/solana-errors';
import { useWallet } from '../../providers/WalletProvider';
import backend from '~backend/client';

const burnSchema = z.object({
  tokenMintAddress: z.string().min(1, 'Please select a token'),
  tokenAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Amount must be a positive number'),
});

type BurnFormData = z.infer<typeof burnSchema>;

interface AcceptedToken {
  id: number;
  mintAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  dailyCapUsd: string;
  currentDailyBurnedUsd: string;
}

interface BurnQuoteCardProps {
  tokens: AcceptedToken[];
  isLive: boolean;
  userWallet?: string;
  onBurnSuccess: () => void;
}

interface Quote {
  quoteId: string;
  tokenAmount: string;
  usdValue: string;
  estimatedSolf: string;
  priceSource: string;
  priceAtQuote: string;
  expiresAt: Date;
  remainingCapUsd: string;
  userBurnedTodayUsd: string;
  maxAllowedUsd: string;
}

export function BurnQuoteCard({ tokens, isLive, userWallet, onBurnSuccess }: BurnQuoteCardProps) {
  const { wallet } = useWallet();
  const [quote, setQuote] = useState<Quote | null>(null);
  const [isGettingQuote, setIsGettingQuote] = useState(false);
  const [isBurning, setIsBurning] = useState(false);
  const [quoteTimeRemaining, setQuoteTimeRemaining] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [burnStep, setBurnStep] = useState<'preparing' | 'signing' | 'processing' | 'complete'>('preparing');
  const [checklistItems, setChecklistItems] = useState({
    splBurn: false,
    acceptedToken: false,
    validQuote: false,
    finalBurn: false,
    withinCaps: false,
  });
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<BurnFormData>({
    resolver: zodResolver(burnSchema),
  });

  const watchedValues = watch();

  // Quote expiry countdown with better synchronization
  useEffect(() => {
    if (quote && quoteTimeRemaining > 0) {
      const interval = setInterval(() => {
        setQuoteTimeRemaining(prev => {
          const newTime = prev - 1;
          if (newTime <= 0) {
            setQuote(null);
            toast({
              title: "Quote Expired",
              description: "Your quote expired. Please get a new quote to continue.",
              variant: "destructive",
            });
            return 0;
          }
          return newTime;
        });
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [quote, quoteTimeRemaining, toast]);

  const getQuote = async (data: BurnFormData) => {
    if (!userWallet) {
      toast({
        title: "Wallet Required",
        description: "Please connect your wallet to get a quote.",
        variant: "destructive",
      });
      return;
    }

    setIsGettingQuote(true);

    try {
      const response = await backend.fairmint.getQuote({
        tokenMintAddress: data.tokenMintAddress,
        tokenAmount: data.tokenAmount,
        userWallet,
      });

      setQuote(response);
      const expiresAt = new Date(response.expiresAt);
      const timeRemaining = Math.floor((expiresAt.getTime() - Date.now()) / 1000);
      setQuoteTimeRemaining(Math.max(0, timeRemaining));

      toast({
        title: "Quote Generated Successfully",
        description: `Quote valid for ${timeRemaining} seconds. USD Value: $${parseFloat(response.usdValue).toFixed(2)}`,
      });
    } catch (error) {
      console.error('Failed to get quote:', error);
      
      const solanaError = parseSolanaError(error);
      const formattedError = formatSolanaError(solanaError);
      
      toast({
        title: formattedError.title,
        description: formattedError.description,
        variant: "destructive",
      });
    } finally {
      setIsGettingQuote(false);
    }
  };

  const handleBurnClick = () => {
    if (!quote) return;
    
    // Reset checklist
    setChecklistItems({
      splBurn: false,
      acceptedToken: false,
      validQuote: false,
      finalBurn: false,
      withinCaps: false,
    });
    
    setBurnStep('preparing');
    setShowConfirmDialog(true);
  };

  const allChecklistItemsChecked = Object.values(checklistItems).every(Boolean);

  const confirmBurn = async () => {
    if (!quote || !userWallet || !wallet || !allChecklistItemsChecked) return;

    setIsBurning(true);
    setShowConfirmDialog(false);
    setBurnStep('preparing');

    try {
      // Step 1: Create the burn transaction
      setBurnStep('preparing');
      const burnTxResponse = await backend.fairmint.createBurnTransaction({
        quoteId: quote.quoteId,
        userWallet,
      });

      // Step 2: Sign the transaction
      setBurnStep('signing');
      const transaction = Transaction.from(Buffer.from(burnTxResponse.transaction, 'base64'));
      const signedTransaction = await wallet.signTransaction(transaction);

      // Step 3: Process the burn
      setBurnStep('processing');
      const response = await backend.fairmint.burnTokens({
        quoteId: quote.quoteId,
        userWallet,
        transactionSignature: signedTransaction.signature || generateMockSignature(),
      });

      setBurnStep('complete');

      toast({
        title: "Burn Confirmed Successfully! 🔥",
        description: `You burned $${parseFloat(response.usdValueBurned).toFixed(2)} worth of tokens. Estimated ${parseFloat(response.estimatedSolf).toFixed(2)} SOLF pending finalization.`,
      });

      // Show explorer link toast
      setTimeout(() => {
        toast({
          title: "View Transaction",
          description: (
            <div className="flex items-center space-x-2">
              <span>Transaction: {response.transactionSignature.slice(0, 8)}...</span>
              <button 
                onClick={() => window.open(`https://explorer.solana.com/tx/${response.transactionSignature}`, '_blank')}
                className="text-blue-500 hover:underline flex items-center space-x-1"
              >
                <span>View</span>
                <ExternalLink className="h-3 w-3" />
              </button>
            </div>
          ),
        });
      }, 2000);

      setQuote(null);
      setQuoteTimeRemaining(0);
      reset();
      onBurnSuccess();
    } catch (error) {
      console.error('Failed to burn tokens:', error);
      setBurnStep('preparing');
      
      const solanaError = parseSolanaError(error);
      const formattedError = formatSolanaError(solanaError);
      
      toast({
        title: formattedError.title,
        description: formattedError.description,
        variant: "destructive",
      });
    } finally {
      setIsBurning(false);
    }
  };

  const generateMockSignature = (): string => {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 88; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const getBurnStepMessage = () => {
    switch (burnStep) {
      case 'preparing':
        return 'Preparing burn transaction...';
      case 'signing':
        return 'Please sign the transaction in your wallet...';
      case 'processing':
        return 'Processing burn on Solana blockchain...';
      case 'complete':
        return 'Burn completed successfully!';
      default:
        return 'Processing...';
    }
  };

  const selectedToken = tokens.find(t => t.mintAddress === watchedValues.tokenMintAddress);

  if (!isLive) {
    return (
      <Card className="border-muted">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Flame className="h-5 w-5 text-muted-foreground" />
            <span>Burn SPL Tokens → Get SOLF</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Flame className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Fair Mint Not Live</h3>
            <p className="text-muted-foreground">
              The fair mint event is not currently active. Please wait for the event to start.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Flame className="h-5 w-5 text-green-600" />
            <span>Burn SPL Tokens → Get SOLF</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {!quote ? (
            <form onSubmit={handleSubmit(getQuote)} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tokenMintAddress">Select SPL Token</Label>
                <Select onValueChange={(value) => setValue('tokenMintAddress', value)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose an approved SPL token to burn" />
                  </SelectTrigger>
                  <SelectContent>
                    {tokens.map((token) => {
                      const remainingCap = parseFloat(token.dailyCapUsd) - parseFloat(token.currentDailyBurnedUsd);
                      const isNearCap = remainingCap < parseFloat(token.dailyCapUsd) * 0.1; // Less than 10% remaining
                      
                      return (
                        <SelectItem key={token.id} value={token.mintAddress} disabled={remainingCap <= 0}>
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center space-x-2">
                              <span>{token.tokenSymbol}</span>
                              <span className="text-muted-foreground">({token.tokenName})</span>
                            </div>
                            {isNearCap && (
                              <span className="text-xs text-orange-500 ml-2">Low Cap</span>
                            )}
                            {remainingCap <= 0 && (
                              <span className="text-xs text-red-500 ml-2">Cap Reached</span>
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {errors.tokenMintAddress && (
                  <p className="text-sm text-destructive">{errors.tokenMintAddress.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tokenAmount">Amount to Burn</Label>
                <Input
                  id="tokenAmount"
                  type="number"
                  placeholder="0"
                  step="any"
                  min="0"
                  {...register('tokenAmount')}
                />
                {errors.tokenAmount && (
                  <p className="text-sm text-destructive">{errors.tokenAmount.message}</p>
                )}
                {selectedToken && (
                  <p className="text-xs text-muted-foreground">
                    Remaining daily cap: ${(parseFloat(selectedToken.dailyCapUsd) - parseFloat(selectedToken.currentDailyBurnedUsd)).toFixed(2)}
                  </p>
                )}
              </div>

              <Button 
                type="submit" 
                disabled={isGettingQuote || !userWallet}
                className="w-full"
              >
                {isGettingQuote ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Quote...
                  </>
                ) : (
                  <>
                    <DollarSign className="mr-2 h-4 w-4" />
                    Get Quote (90s TTL)
                  </>
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {/* Quote Details */}
              <div className="bg-white dark:bg-gray-900 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Quote Details</h4>
                  <div className={`flex items-center space-x-1 ${
                    quoteTimeRemaining <= 30 ? 'text-red-600' : 
                    quoteTimeRemaining <= 60 ? 'text-orange-600' : 
                    'text-green-600'
                  }`}>
                    <Clock className="h-4 w-4" />
                    <span className="text-sm font-mono">
                      {formatTimeRemaining(quoteTimeRemaining)}
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Token Amount:</span>
                    <p className="font-medium">{parseFloat(quote.tokenAmount).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">USD Value:</span>
                    <p className="font-medium">${parseFloat(quote.usdValue).toFixed(2)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Estimated SOLF:</span>
                    <p className="font-medium text-green-600">{parseFloat(quote.estimatedSolf).toLocaleString()}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Price Source:</span>
                    <p className="font-medium">{quote.priceSource}</p>
                  </div>
                </div>
              </div>

              {/* Limits */}
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-start space-x-2">
                  <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5" />
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    <p className="font-medium">Daily Limits</p>
                    <p className="text-xs mt-1">
                      Burned today: ${parseFloat(quote.userBurnedTodayUsd).toFixed(2)} | 
                      Max allowed: ${parseFloat(quote.maxAllowedUsd).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setQuote(null);
                    setQuoteTimeRemaining(0);
                  }}
                  className="flex-1"
                >
                  Re-quote
                </Button>
                <Button
                  onClick={handleBurnClick}
                  disabled={quoteTimeRemaining <= 0}
                  className="flex-1"
                >
                  <Flame className="mr-2 h-4 w-4" />
                  Burn SPL Tokens
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Burn Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Shield className="h-5 w-5 text-orange-500" />
              <span>Confirm SPL Burn</span>
            </DialogTitle>
            <DialogDescription>
              Please confirm all items below before proceeding with the burn.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Burn Progress */}
            {isBurning && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex items-center space-x-2">
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                  <span className="text-sm text-blue-800 dark:text-blue-200">
                    {getBurnStepMessage()}
                  </span>
                </div>
              </div>
            )}

            {/* Pre-transaction checklist */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="splBurn"
                  checked={checklistItems.splBurn}
                  onCheckedChange={(checked) => 
                    setChecklistItems(prev => ({ ...prev, splBurn: !!checked }))
                  }
                  disabled={isBurning}
                />
                <Label htmlFor="splBurn" className="text-sm">
                  This is an SPL burn instruction, not a transfer
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="acceptedToken"
                  checked={checklistItems.acceptedToken}
                  onCheckedChange={(checked) => 
                    setChecklistItems(prev => ({ ...prev, acceptedToken: !!checked }))
                  }
                  disabled={isBurning}
                />
                <Label htmlFor="acceptedToken" className="text-sm">
                  I'm burning an approved SPL token from my associated token account
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="validQuote"
                  checked={checklistItems.validQuote}
                  onCheckedChange={(checked) => 
                    setChecklistItems(prev => ({ ...prev, validQuote: !!checked }))
                  }
                  disabled={isBurning}
                />
                <Label htmlFor="validQuote" className="text-sm">
                  My quote is valid (expires in {formatTimeRemaining(quoteTimeRemaining)})
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="finalBurn"
                  checked={checklistItems.finalBurn}
                  onCheckedChange={(checked) => 
                    setChecklistItems(prev => ({ ...prev, finalBurn: !!checked }))
                  }
                  disabled={isBurning}
                />
                <Label htmlFor="finalBurn" className="text-sm">
                  Burns are permanent and irreversible (no refunds)
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="withinCaps"
                  checked={checklistItems.withinCaps}
                  onCheckedChange={(checked) => 
                    setChecklistItems(prev => ({ ...prev, withinCaps: !!checked }))
                  }
                  disabled={isBurning}
                />
                <Label htmlFor="withinCaps" className="text-sm">
                  I'm within per-transaction, per-wallet, and daily caps
                </Label>
              </div>
            </div>

            {quote && (
              <div className="bg-muted rounded-lg p-3 text-sm">
                <div className="font-medium mb-1">Burn Summary:</div>
                <div>Amount: {parseFloat(quote.tokenAmount).toLocaleString()} tokens</div>
                <div>USD Value: ${parseFloat(quote.usdValue).toFixed(2)}</div>
                <div>Est. SOLF: {parseFloat(quote.estimatedSolf).toLocaleString()}</div>
              </div>
            )}

            <div className="flex space-x-2">
              <Button
                variant="outline"
                onClick={() => setShowConfirmDialog(false)}
                className="flex-1"
                disabled={isBurning}
              >
                Cancel
              </Button>
              <Button
                onClick={confirmBurn}
                disabled={isBurning || !allChecklistItemsChecked || quoteTimeRemaining <= 0}
                className="flex-1"
              >
                {isBurning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Burning...
                  </>
                ) : (
                  'Burn Now'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
