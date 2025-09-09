import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Send, AlertTriangle } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import backend from '~backend/client';

const transferSchema = z.object({
  toAddress: z.string().min(1, 'Recipient address is required'),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Amount must be a positive number'),
});

type TransferFormData = z.infer<typeof transferSchema>;

interface TokenTransferDialogProps {
  token: {
    mintAddress: string;
    name: string;
    symbol: string;
    decimals: number;
    userBalance?: string;
  };
  onTransferSuccess: () => void;
}

export function TokenTransferDialog({ token, onTransferSuccess }: TokenTransferDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const userBalance = parseFloat(token.userBalance || '0');

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<TransferFormData>({
    resolver: zodResolver(transferSchema),
  });

  const watchedAmount = watch('amount');
  const transferAmount = parseFloat(watchedAmount || '0');
  const isAmountValid = !isNaN(transferAmount) && transferAmount > 0 && transferAmount <= userBalance;

  const onSubmit = async (data: TransferFormData) => {
    if (!publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to transfer tokens.",
        variant: "destructive",
      });
      return;
    }

    if (transferAmount > userBalance) {
      toast({
        title: "Insufficient Balance",
        description: `You only have ${userBalance} ${token.symbol} tokens.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // In a real implementation, this would use SPL Token program
      // For now, we'll simulate the transfer and record it
      const mockTransactionSignature = generateMockSignature();

      const response = await backend.token.recordTransfer({
        mintAddress: token.mintAddress,
        fromAddress: publicKey.toString(),
        toAddress: data.toAddress,
        amount: data.amount,
        transactionSignature: mockTransactionSignature,
      });

      toast({
        title: "Transfer Successful!",
        description: `Transferred ${data.amount} ${token.symbol} to ${data.toAddress.slice(0, 4)}...${data.toAddress.slice(-4)}`,
      });

      reset();
      setOpen(false);
      onTransferSuccess();
    } catch (error) {
      console.error('Failed to transfer tokens:', error);
      toast({
        title: "Transfer Failed",
        description: error instanceof Error ? error.message : "Failed to transfer tokens.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillMyAddress = () => {
    if (publicKey) {
      setValue('toAddress', publicKey.toString());
    }
  };

  const setMaxAmount = () => {
    setValue('amount', userBalance.toString());
  };

  // Mock function to generate transaction signature
  const generateMockSignature = (): string => {
    const chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 88; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  };

  if (!token.userBalance || userBalance <= 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center space-x-1">
          <Send className="h-3 w-3" />
          <span>Transfer</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Transfer {token.symbol} Tokens</DialogTitle>
          <DialogDescription>
            Send {token.symbol} tokens to any Solana wallet address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Token Info */}
          <div className="bg-muted rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Token:</span>
              <span className="font-medium">{token.name} ({token.symbol})</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Available Balance:</span>
              <span className="font-medium">{userBalance.toLocaleString()} {token.symbol}</span>
            </div>
          </div>

          {/* Transfer Simulation Warning */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <p className="font-medium">Demo Mode</p>
                <p className="text-xs">This is a simulated transfer for demonstration. In production, this would interact with the SPL Token program.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="toAddress">Recipient Address</Label>
              <div className="flex space-x-2">
                <Input
                  id="toAddress"
                  placeholder="Enter recipient wallet address"
                  {...register('toAddress')}
                  className={errors.toAddress ? 'border-destructive' : ''}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillMyAddress}
                  disabled={!publicKey}
                >
                  Self
                </Button>
              </div>
              {errors.toAddress && (
                <p className="text-sm text-destructive">{errors.toAddress.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <div className="flex space-x-2">
                <Input
                  id="amount"
                  type="number"
                  placeholder="0"
                  step="any"
                  min="0"
                  max={userBalance}
                  {...register('amount')}
                  className={errors.amount ? 'border-destructive' : ''}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={setMaxAmount}
                >
                  Max
                </Button>
              </div>
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Available: {userBalance.toLocaleString()} {token.symbol}</span>
                {transferAmount > userBalance && (
                  <span className="text-destructive">Exceeds available balance</span>
                )}
              </div>
            </div>

            <div className="flex space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !isAmountValid}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transferring...
                  </>
                ) : (
                  'Transfer Tokens'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
