import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight, AlertTriangle, ExternalLink, CheckCircle, Info } from 'lucide-react';
import { useConnection, useWallet } from '@solana/wallet-adapter-react';
import { PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { withRetry, handleError } from '../../utils/error-handling';
import backend from '~backend/client';
import { SOLF_CONFIG, SOLANA_ADDRESSES } from '../../config';

const purchaseSchema = z.object({
  solAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= SOLF_CONFIG.minPurchase && num <= SOLF_CONFIG.maxPurchase;
  }, `SOL amount must be between ${SOLF_CONFIG.minPurchase} and ${SOLF_CONFIG.maxPurchase}`),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

export function SOLFPurchaseForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [processingPurchase, setProcessingPurchase] = useState(false);
  const [completedTxSig, setCompletedTxSig] = useState<string | null>(null);
  const { publicKey, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    reset,
  } = useForm<PurchaseFormData>({
    resolver: zodResolver(purchaseSchema),
    defaultValues: {
      solAmount: String(SOLF_CONFIG.minPurchase),
    },
  });

  const watchedSolAmount = watch('solAmount');
  const solAmount = parseFloat(watchedSolAmount || '0');
  const solfAmount = isNaN(solAmount) ? 0 : solAmount * SOLF_CONFIG.exchangeRate;
  const totalCost = isNaN(solAmount) ? 0 : solAmount + SOLF_CONFIG.platformFee;

  const setMaxAmount = () => {
    setValue('solAmount', '10');
  };

  const onSubmit = async (data: PurchaseFormData) => {
    if (!publicKey || !sendTransaction) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to purchase SOLF.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    setCreatingTransaction(true);

    try {
      const solAmountNumber = parseFloat(data.solAmount);
      
      const balance = await withRetry(async () => {
        return await connection.getBalance(publicKey);
      }, 3, 1000);
      
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      const requiredAmount = solAmountNumber + SOLF_CONFIG.platformFee + 0.01;
      
      if (balanceInSol < requiredAmount) {
        throw new Error(`Insufficient balance. Required: ${requiredAmount.toFixed(3)} SOL, Available: ${balanceInSol.toFixed(4)} SOL`);
      }

      const transaction = new Transaction();
      
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(SOLANA_ADDRESSES.treasuryWallet()),
          lamports: Math.floor(solAmountNumber * LAMPORTS_PER_SOL),
        })
      );

      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(SOLANA_ADDRESSES.teamWallet()),
          lamports: Math.floor(SOLF_CONFIG.platformFee * LAMPORTS_PER_SOL),
        })
      );

      setCreatingTransaction(false);

      const txSig = await sendTransaction(transaction, connection);

      toast({
        title: "Transaction Sent",
        description: `Payment sent! Processing SOLF distribution...`,
      });

      setProcessingPurchase(true);

      await connection.confirmTransaction({ signature: txSig, ...(await connection.getLatestBlockhash()) }, 'confirmed');

      const response = await backend.launchpad.buy({
        wallet: publicKey.toString(),
        txSig: txSig,
      });

      if (response.ok) {
        setCompletedTxSig(txSig);
        toast({
          title: "Purchase Successful!",
          description: `You received ${response.solfReceived} SOLF tokens!`,
        });
        reset();
      } else {
        throw new Error("Failed to process SOLF distribution");
      }

    } catch (error) {
      console.error('SOLF purchase failed:', error);
      handleError(error, 'SOLF purchase');
    } finally {
      setIsSubmitting(false);
      setCreatingTransaction(false);
      setProcessingPurchase(false);
    }
  };

  if (completedTxSig) {
    return (
      <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
        <CardHeader className="text-center">
          <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
          </div>
          <CardTitle className="text-green-800 dark:text-green-200">Purchase Complete!</CardTitle>
          <CardDescription className="text-green-700 dark:text-green-300">
            Your SOLF tokens have been distributed to your wallet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center space-y-2">
            <p className="text-sm text-green-700 dark:text-green-300">
              Transaction: <span className="font-mono text-xs">{completedTxSig.slice(0, 8)}...{completedTxSig.slice(-8)}</span>
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`https://explorer.solana.com/tx/${completedTxSig}?cluster=devnet`, '_blank')}
              className="flex items-center space-x-1"
            >
              <ExternalLink className="h-3 w-3" />
              <span>View on Explorer</span>
            </Button>
          </div>
          <Button
            onClick={() => {
              setCompletedTxSig(null);
              reset();
            }}
            className="w-full"
          >
            Make Another Purchase
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buy SOLF Tokens</CardTitle>
        <CardDescription>
          Get SOLF tokens with SOL at a fixed rate from our dedicated {SOLF_CONFIG.treasuryAllocation.toLocaleString()} treasury allocation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Exchange Rate:</span>
              <span className="font-medium">1 SOL = {SOLF_CONFIG.exchangeRate.toLocaleString()} SOLF</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee:</span>
              <span className="font-medium">{SOLF_CONFIG.platformFee} SOL per transaction</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Treasury Allocation:</span>
              <span className="font-medium">{SOLF_CONFIG.treasuryAllocation.toLocaleString()} SOLF ({SOLF_CONFIG.treasuryAllocation / SOLF_CONFIG.totalSupply * 100}%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total SOL Capacity:</span>
              <span className="font-medium">{(SOLF_CONFIG.treasuryAllocation / SOLF_CONFIG.exchangeRate).toLocaleString()} SOL</span>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <h4 className="font-semibold mb-1">Fixed Supply Economics</h4>
                <ul className="space-y-1 text-xs">
                  <li>• Total Supply: {SOLF_CONFIG.totalSupply.toLocaleString()} SOLF (capped permanently)</li>
                  <li>• Treasury: {SOLF_CONFIG.treasuryAllocation.toLocaleString()} SOLF available for launchpad</li>
                  <li>• Mint authority revoked - no new tokens can ever be created</li>
                  <li>• Rate may adjust if demand exceeds current capacity</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="solAmount">SOL Amount</Label>
            <div className="flex space-x-2">
              <Input
                id="solAmount"
                type="number"
                placeholder={String(SOLF_CONFIG.minPurchase)}
                step="0.1"
                min={SOLF_CONFIG.minPurchase}
                max={SOLF_CONFIG.maxPurchase}
                {...register('solAmount')}
                className={errors.solAmount ? 'border-destructive' : ''}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={setMaxAmount}
              >
                10 SOL
              </Button>
            </div>
            {errors.solAmount && (
              <p className="text-sm text-destructive">{errors.solAmount.message}</p>
            )}
          </div>

          <div className="space-y-3">
            <h4 className="font-medium">Purchase Summary</h4>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SOL for SOLF:</span>
                <span className="font-medium">{solAmount.toFixed(2)} SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee:</span>
                <span className="font-medium">{SOLF_CONFIG.platformFee} SOL</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">Total Cost:</span>
                <span className="font-bold">{totalCost.toFixed(2)} SOL</span>
              </div>
              <div className="border-t pt-2 flex justify-between">
                <span className="font-medium">You Will Receive:</span>
                <span className="font-bold text-green-600">{solfAmount.toLocaleString()} SOLF</span>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <h4 className="font-semibold mb-1">How it works:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• Your payment is split: {solAmount.toFixed(2)} SOL to Treasury, {SOLF_CONFIG.platformFee} SOL to Team</li>
                  <li>• SOLF tokens are automatically transferred from Treasury wallet</li>
                  <li>• Transaction is final and irreversible</li>
                  <li>• Launchpad stops when Treasury allocation is depleted</li>
                  <li>• Make sure you have extra SOL for transaction fees</li>
                </ul>
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={isSubmitting || solAmount < SOLF_CONFIG.minPurchase}
            className="w-full"
            size="lg"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {creatingTransaction ? 'Creating Transaction...' :
                 processingPurchase ? 'Processing SOLF Distribution...' : 'Purchasing...'}
              </>
            ) : (
              <>
                <span>Buy {solfAmount.toLocaleString()} SOLF for {totalCost.toFixed(2)} SOL</span>
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
