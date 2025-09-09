import React, { useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { useWallet } from '../../providers/WalletProvider';
import backend from '~backend/client';

const isNumeric = (s: string) => /^-?\d+(\.\d+)?$/.test(s);

const acceptedTokenSchema = z.object({
  mintAddress: z.string().min(32, "Valid SPL mint address is required"),
  tokenName: z.string().min(1, "Token name is required"),
  tokenSymbol: z.string().min(1, "Token symbol is required"),
  tokenLogoUrl: z.string().url().optional().or(z.literal('')),
  dailyCapUsd: z.string().refine(isNumeric, "Must be a numeric value"),
});

const createEventSchema = z.object({
  eventName: z.string().min(3, "Event name must be at least 3 characters"),
  description: z.string().optional(),
  startTime: z.coerce.date(),
  endTime: z.coerce.date(),
  tgePercentage: z.coerce.number().int().min(0).max(100),
  vestingDays: z.coerce.number().int().min(1).max(365),
  platformFeeBps: z.coerce.number().int().min(0).max(1000),
  referralPoolPercentage: z.coerce.number().int().min(0).max(20),
  maxPerWalletUsd: z.string().refine(isNumeric),
  maxPerTxUsd: z.string().refine(isNumeric),
  minTxUsd: z.string().refine(isNumeric),
  quoteTtlSeconds: z.coerce.number().int().min(1).max(3600).default(60),
  treasuryAddress: z.string().min(32, "Valid Solana address is required"),
  acceptedTokens: z.array(acceptedTokenSchema).min(1, "At least one accepted token is required").max(20),
}).refine(data => data.startTime < data.endTime, {
  message: "End time must be after start time",
  path: ["endTime"],
});

type CreateEventFormData = z.infer<typeof createEventSchema>;

export function CreateFairMintForm() {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      eventName: "Proof-of-Burn Fair Mint",
      description: "A 72-hour Fair Mint where users burn admin-approved SPL tokens (no LPs) and receive SOLF pro-rata by USD value at burn time.",
      tgePercentage: 20,
      vestingDays: 30,
      platformFeeBps: 150,
      referralPoolPercentage: 3,
      maxPerWalletUsd: "5000",
      maxPerTxUsd: "2500",
      minTxUsd: "20",
      quoteTtlSeconds: 60,
      acceptedTokens: [{ mintAddress: "", tokenName: "", tokenSymbol: "", dailyCapUsd: "250000", tokenLogoUrl: "" }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "acceptedTokens",
  });

  const onSubmit = async (data: CreateEventFormData) => {
    if (!publicKey) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      await backend.fairmint.createEvent({
        ...data,
        adminWallet: publicKey.toString(),
      });
      toast({
        title: "Event Created Successfully!",
        description: `Fair mint event "${data.eventName}" has been created.`,
      });
    } catch (error) {
      console.error("Failed to create event:", error);
      toast({
        title: "Creation Failed",
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
        <CardTitle>Create New Fair Mint Event</CardTitle>
        <CardDescription>Configure and launch a new SPL token burning event.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Event Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventName">Event Name</Label>
                <Input id="eventName" {...register('eventName')} />
                {errors.eventName && <p className="text-sm text-destructive">{errors.eventName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="treasuryAddress">Treasury Address</Label>
                <Input id="treasuryAddress" {...register('treasuryAddress')} />
                {errors.treasuryAddress && <p className="text-sm text-destructive">{errors.treasuryAddress.message}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" {...register('description')} />
              {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time</Label>
                <Input id="startTime" type="datetime-local" {...register('startTime')} />
                {errors.startTime && <p className="text-sm text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time</Label>
                <Input id="endTime" type="datetime-local" {...register('endTime')} />
                {errors.endTime && <p className="text-sm text-destructive">{errors.endTime.message}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Tokenomics</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="tgePercentage">TGE %</Label>
                <Input id="tgePercentage" type="number" {...register('tgePercentage')} />
                {errors.tgePercentage && <p className="text-sm text-destructive">{errors.tgePercentage.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="vestingDays">Vesting Days</Label>
                <Input id="vestingDays" type="number" {...register('vestingDays')} />
                {errors.vestingDays && <p className="text-sm text-destructive">{errors.vestingDays.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="platformFeeBps">Platform Fee (bps)</Label>
                <Input id="platformFeeBps" type="number" {...register('platformFeeBps')} />
                {errors.platformFeeBps && <p className="text-sm text-destructive">{errors.platformFeeBps.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="referralPoolPercentage">Referral Pool %</Label>
                <Input id="referralPoolPercentage" type="number" {...register('referralPoolPercentage')} />
                {errors.referralPoolPercentage && <p className="text-sm text-destructive">{errors.referralPoolPercentage.message}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Limits & Rules</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minTxUsd">Min Tx (USD)</Label>
                <Input id="minTxUsd" {...register('minTxUsd')} />
                {errors.minTxUsd && <p className="text-sm text-destructive">{errors.minTxUsd.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPerTxUsd">Max Tx (USD)</Label>
                <Input id="maxPerTxUsd" {...register('maxPerTxUsd')} />
                {errors.maxPerTxUsd && <p className="text-sm text-destructive">{errors.maxPerTxUsd.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxPerWalletUsd">Max Wallet (USD)</Label>
                <Input id="maxPerWalletUsd" {...register('maxPerWalletUsd')} />
                {errors.maxPerWalletUsd && <p className="text-sm text-destructive">{errors.maxPerWalletUsd.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="quoteTtlSeconds">Quote TTL (s)</Label>
                <Input id="quoteTtlSeconds" type="number" {...register('quoteTtlSeconds')} />
                {errors.quoteTtlSeconds && <p className="text-sm text-destructive">{errors.quoteTtlSeconds.message}</p>}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium">Accepted Tokens</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                {fields.length > 1 && (
                  <Button type="button" variant="destructive" size="icon" className="absolute top-2 right-2 h-7 w-7" onClick={() => remove(index)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Mint Address</Label>
                    <Input {...register(`acceptedTokens.${index}.mintAddress`)} />
                    {errors.acceptedTokens?.[index]?.mintAddress && <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.mintAddress?.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Token Name</Label>
                    <Input {...register(`acceptedTokens.${index}.tokenName`)} />
                    {errors.acceptedTokens?.[index]?.tokenName && <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.tokenName?.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Token Symbol</Label>
                    <Input {...register(`acceptedTokens.${index}.tokenSymbol`)} />
                    {errors.acceptedTokens?.[index]?.tokenSymbol && <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.tokenSymbol?.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label>Token Logo URL</Label>
                    <Input {...register(`acceptedTokens.${index}.tokenLogoUrl`)} />
                    {errors.acceptedTokens?.[index]?.tokenLogoUrl && <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.tokenLogoUrl?.message}</p>}
                  </div>
                  <div className="space-y-2 col-span-full">
                    <Label>Daily Cap (USD)</Label>
                    <Input {...register(`acceptedTokens.${index}.dailyCapUsd`)} />
                    {errors.acceptedTokens?.[index]?.dailyCapUsd && <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.dailyCapUsd?.message}</p>}
                  </div>
                </div>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={() => append({ mintAddress: "", tokenName: "", tokenSymbol: "", dailyCapUsd: "250000", tokenLogoUrl: "" })}>
              <Plus className="mr-2 h-4 w-4" /> Add Token
            </Button>
            {errors.acceptedTokens && <p className="text-sm text-destructive">{errors.acceptedTokens.message}</p>}
          </div>

          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating Event...
              </>
            ) : (
              'Create Event'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
