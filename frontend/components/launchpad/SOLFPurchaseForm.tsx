import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, ArrowRight, AlertTriangle, ExternalLink, CheckCircle, Info } from 'lucide-react';
import { useWallet } from '../../providers/WalletProvider';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { SOLANA_RPC_ENDPOINT } from '../../config';
import { parseSolanaError, formatSolanaError } from '../../utils/solana-errors';
import backend from '~backend/client';

const purchaseSchema = z.object({
  solAmount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num >= 0.2 && num <= 1000;
  }, 'SOL amount must be between 0.2 and 1000'),
});

type PurchaseFormData = z.infer<typeof purchaseSchema>;

// Hardcoded wallet addresses for the demo
const TREASURY_WALLET = "7wBKaVpxKBa31VgY4HBd7xzCu3AxoAzK8LjGr9zn8YxJ";
const TEAM_WALLET = "3YkFz8vUBa7mLrCcGx4nKzDu5AxoAzK8LjGr9zn8YxJ";

const SOLF_PER_SOL = 10000;
const FEE_AMOUNT = 0.1;

// Updated tokenomics constants
const TOTAL_SUPPLY = 500000000; // 500M SOLF
const TREASURY_ALLOCATION = 250000000; // 250M SOLF for launchpad (50%)
const MAX_SOL_CAPACITY = TREASURY_ALLOCATION / SOLF_PER_SOL; // 25,000 SOL

export function SOLFPurchaseForm() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [creatingTransaction, setCreatingTransaction] = useState(false);
  const [processingPurchase, setProcessingPurchase] = useState(false);
  const [completedTxSig, setCompletedTxSig] = useState<string | null>(null);
  const { publicKey, wallet } = useWallet();
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
      solAmount: '0.2',
    },
  });

  const watchedSolAmount = watch('solAmount');
  const solAmount = parseFloat(watchedSolAmount || '0');
  const solfAmount = isNaN(solAmount) ? 0 : solAmount * SOLF_PER_SOL;
  const totalCost = isNaN(solAmount) ? 0 : solAmount + FEE_AMOUNT;

  const setMaxAmount = () => {
    setValue('solAmount', '10');
  };

  const onSubmit = async (data: PurchaseFormData) => {
    if (!publicKey || !wallet) {
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
      const connection = new Connection(SOLANA_RPC_ENDPOINT);
      const solAmountNumber = parseFloat(data.solAmount);
      
      // Check wallet balance
      const balance = await connection.getBalance(publicKey);
      const balanceInSol = balance / LAMPORTS_PER_SOL;
      const requiredAmount = solAmountNumber + FEE_AMOUNT + 0.01; // Extra for tx fees
      
      if (balanceInSol < requiredAmount) {
        throw new Error(`Insufficient balance. Required: ${requiredAmount.toFixed(3)} SOL, Available: ${balanceInSol.toFixed(4)} SOL`);
      }

      // Create transaction
      const transaction = new Transaction();
      
      // Add transfer to treasury
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(TREASURY_WALLET),
          lamports: Math.floor(solAmountNumber * LAMPORTS_PER_SOL),
        })
      );

      // Add fee transfer to team wallet
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey(TEAM_WALLET),
          lamports: Math.floor(FEE_AMOUNT * LAMPORTS_PER_SOL),
        })
      );

      // Get latest blockhash
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      setCreatingTransaction(false);

      // Sign transaction
      const signedTransaction = await wallet.signTransaction(transaction);
      
      // Send transaction
      const txSig = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed'
      });

      toast({
        title: "Transaction Sent",
        description: `Payment sent! Processing SOLF distribution...`,
      });

      setProcessingPurchase(true);

      // Wait for confirmation
      const confirmation = await connection.confirmTransaction(txSig, 'confirmed');
      if (confirmation.value.err) {
        throw new Error(`Transaction failed: ${JSON.stringify(confirmation.value.err)}`);
      }

      // Process purchase through backend
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
      
      const solanaError = parseSolanaError(error);
      const formattedError = formatSolanaError(solanaError);
      
      toast({
        title: formattedError.title,
        description: formattedError.description,
        variant: "destructive",
      });
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
              onClick={() => window.open(`https://explorer.solana.com/tx/${completedTxSig}`, '_blank')}
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
          Get SOLF tokens with SOL at a fixed rate from our dedicated 250M treasury allocation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Updated Tokenomics Info */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Exchange Rate:</span>
              <span className="font-medium">1 SOL = {SOLF_PER_SOL.toLocaleString()} SOLF</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Platform Fee:</span>
              <span className="font-medium">{FEE_AMOUNT} SOL per transaction</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Treasury Allocation:</span>
              <span className="font-medium">{TREASURY_ALLOCATION.toLocaleString()} SOLF (50%)</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Total SOL Capacity:</span>
              <span className="font-medium">{MAX_SOL_CAPACITY.toLocaleString()} SOL</span>
            </div>
          </div>

          {/* Supply Information */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <h4 className="font-semibold mb-1">Fixed Supply Economics</h4>
                <ul className="space-y-1 text-xs">
                  <li>• Total Supply: {TOTAL_SUPPLY.toLocaleString()} SOLF (capped permanently)</li>
                  <li>• Treasury: {TREASURY_ALLOCATION.toLocaleString()} SOLF available for launchpad</li>
                  <li>• Mint authority revoked - no new tokens can ever be created</li>
                  <li>• Rate may adjust if demand exceeds current capacity</li>
                </ul>
              </div>
            </div>
          </div>

          {/* SOL Amount Input */}
          <div className="space-y-2">
            <Label htmlFor="solAmount">SOL Amount</Label>
            <div className="flex space-x-2">
              <Input
                id="solAmount"
                type="number"
                placeholder="0.2"
                step="0.1"
                min="0.2"
                max="1000"
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

          {/* Purchase Summary */}
          <div className="space-y-3">
            <h4 className="font-medium">Purchase Summary</h4>
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">SOL for SOLF:</span>
                <span className="font-medium">{solAmount.toFixed(2)} SOL</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Platform Fee:</span>
                <span className="font-medium">{FEE_AMOUNT} SOL</span>
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

          {/* Important Info */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <h4 className="font-semibold mb-1">How it works:</h4>
                <ul className="space-y-1 text-xs">
                  <li>• Your payment is split: {solAmount.toFixed(2)} SOL to Treasury, {FEE_AMOUNT} SOL to Team</li>
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
            disabled={isSubmitting || solAmount < 0.2}
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
