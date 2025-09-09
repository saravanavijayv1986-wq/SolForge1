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
import { Loader2, Coins } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import backend from '~backend/client';

const mintSchema = z.object({
  recipientAddress: z.string().min(1, 'Recipient address is required'),
  amount: z.string().refine((val) => {
    const num = parseFloat(val);
    return !isNaN(num) && num > 0;
  }, 'Amount must be a positive number'),
});

type MintFormData = z.infer<typeof mintSchema>;

interface TokenMintDialogProps {
  token: {
    mintAddress: string;
    name: string;
    symbol: string;
    supply: string;
    totalMinted: string;
    decimals: number;
    isMintable: boolean;
  };
  onMintSuccess: () => void;
}

export function TokenMintDialog({ token, onMintSuccess }: TokenMintDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<MintFormData>({
    resolver: zodResolver(mintSchema),
  });

  const remainingSupply = parseFloat(token.supply) - parseFloat(token.totalMinted);

  const onSubmit = async (data: MintFormData) => {
    if (!publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to mint tokens.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await backend.token.mint({
        mintAddress: token.mintAddress,
        recipientAddress: data.recipientAddress,
        amount: data.amount,
        minterWallet: publicKey.toString(),
      });

      toast({
        title: "Tokens Minted Successfully!",
        description: `Minted ${data.amount} ${token.symbol} tokens to ${data.recipientAddress.slice(0, 4)}...${data.recipientAddress.slice(-4)}`,
      });

      reset();
      setOpen(false);
      onMintSuccess();
    } catch (error) {
      console.error('Failed to mint tokens:', error);
      toast({
        title: "Minting Failed",
        description: error instanceof Error ? error.message : "Failed to mint tokens.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const fillMyAddress = () => {
    if (publicKey) {
      setValue('recipientAddress', publicKey.toString());
    }
  };

  if (!token.isMintable) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="flex items-center space-x-1">
          <Coins className="h-3 w-3" />
          <span>Mint</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Mint {token.symbol} Tokens</DialogTitle>
          <DialogDescription>
            Mint new tokens to any Solana wallet address
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
              <span className="text-muted-foreground">Total Supply:</span>
              <span>{Number(token.supply).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Minted:</span>
              <span>{Number(token.totalMinted).toLocaleString()}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Remaining:</span>
              <span className="font-medium">{remainingSupply.toLocaleString()}</span>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="recipientAddress">Recipient Address</Label>
              <div className="flex space-x-2">
                <Input
                  id="recipientAddress"
                  placeholder="Enter wallet address"
                  {...register('recipientAddress')}
                  className={errors.recipientAddress ? 'border-destructive' : ''}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={fillMyAddress}
                  disabled={!publicKey}
                >
                  My Address
                </Button>
              </div>
              {errors.recipientAddress && (
                <p className="text-sm text-destructive">{errors.recipientAddress.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                placeholder="0"
                step="any"
                min="0.000000001"
                max={remainingSupply}
                {...register('amount')}
                className={errors.amount ? 'border-destructive' : ''}
              />
              {errors.amount && (
                <p className="text-sm text-destructive">{errors.amount.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Maximum: {remainingSupply.toLocaleString()} tokens
              </p>
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
                disabled={isSubmitting || remainingSupply <= 0}
                className="flex-1"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Minting...
                  </>
                ) : (
                  'Mint Tokens'
                )}
              </Button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
