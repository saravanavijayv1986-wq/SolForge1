import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Flame } from 'lucide-react';
import { useWallet } from '../../providers/WalletProvider';
import backend from '~backend/client';
import { useQueryClient } from '@tanstack/react-query';

const burnSchema = z.object({
  mintAddress: z.string().min(32, "Valid SPL mint address is required"),
  amountUi: z.string().refine((val) => parseFloat(val) > 0, "Amount must be positive"),
  txSig: z.string().min(44, "Valid transaction signature is required"),
});

type BurnFormData = z.infer<typeof burnSchema>;

interface BurnFormProps {
  eventId: number;
}

export function BurnForm({ eventId }: BurnFormProps) {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const queryClient = useQueryClient();

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BurnFormData>({
    resolver: zodResolver(burnSchema),
  });

  const onSubmit = async (data: BurnFormData) => {
    if (!publicKey) {
      toast({ title: "Wallet Not Connected", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await backend.fairmint.submitBurn({
        eventId,
        wallet: publicKey.toString(),
        ...data,
      });

      if (response.ok) {
        toast({
          title: "Burn Submitted Successfully!",
          description: `Your burn of $${parseFloat(response.usd).toFixed(2)} has been recorded.`,
        });
        reset();
        queryClient.invalidateQueries({ queryKey: ['fairMintStats', eventId] });
      } else {
        throw new Error("Burn submission failed.");
      }
    } catch (error) {
      console.error("Burn submission error:", error);
      toast({
        title: "Submission Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Flame className="h-5 w-5 text-orange-500" />
          <span>Submit Your Burn</span>
        </CardTitle>
        <CardDescription>
          After burning an accepted SPL token, submit the transaction signature here to get credit.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="mintAddress">Token Mint Address</Label>
            <Input id="mintAddress" placeholder="e.g., So1111..." {...register('mintAddress')} />
            {errors.mintAddress && <p className="text-sm text-destructive">{errors.mintAddress.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="amountUi">Amount Burned (UI Amount)</Label>
            <Input id="amountUi" type="number" step="any" placeholder="e.g., 10.5" {...register('amountUi')} />
            {errors.amountUi && <p className="text-sm text-destructive">{errors.amountUi.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="txSig">Transaction Signature</Label>
            <Input id="txSig" placeholder="e.g., 2z...Zp" {...register('txSig')} />
            {errors.txSig && <p className="text-sm text-destructive">{errors.txSig.message}</p>}
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Verifying...
              </>
            ) : (
              'Submit Burn Proof'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
