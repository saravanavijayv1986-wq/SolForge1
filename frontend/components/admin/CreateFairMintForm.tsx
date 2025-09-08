import React, { useState, useEffect } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Plus, Trash2, AlertTriangle, Info, CheckCircle, Shield } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useWallet } from '../../providers/WalletProvider';
import backend from '~backend/client';

const acceptedTokenSchema = z.object({
  mintAddress: z.string().min(32, "Valid SPL mint address is required (32+ characters)"),
  tokenName: z.string().min(1, "Token name is required").max(50, "Token name too long"),
  tokenSymbol: z.string().min(1, "Token symbol is required").max(10, "Token symbol too long"),
  tokenLogoUrl: z.string().url({ message: "Invalid URL" }).optional().or(z.literal('')),
  dailyCapUsd: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0 && parseFloat(v) <= 10000000, "Must be between $1 and $10M"),
  dexPriceSource: z.string().optional(),
});

const createEventSchema = z.object({
  eventName: z.string().min(1, "Event name is required").max(100, "Event name too long"),
  description: z.string().max(500, "Description too long").optional(),
  startTime: z.string().min(1, "Start time is required").refine(
    (val) => new Date(val) > new Date(Date.now() + 300000), // At least 5 minutes in the future
    "Start time must be at least 5 minutes in the future"
  ),
  endTime: z.string().min(1, "End time is required"),
  acceptedTokens: z.array(acceptedTokenSchema).min(1, "At least one SPL token is required").max(20, "Maximum 20 tokens allowed"),
  tgePercentage: z.number().min(0, "Must be 0 or greater").max(100, "Cannot exceed 100%"),
  vestingDays: z.number().min(1, "Must be at least 1 day").max(365, "Cannot exceed 365 days").int("Must be a whole number"),
  platformFeeBps: z.number().min(0, "Must be 0 or greater").max(1000, "Cannot exceed 10% (1000 bps)").int("Must be a whole number"),
  maxPerWalletUsd: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be a positive number"),
  maxPerTxUsd: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) > 0, "Must be a positive number"),
  quoteTtlSeconds: z.number().min(30, "Must be at least 30 seconds").max(300, "Cannot exceed 5 minutes").int("Must be a whole number"),
  minTxUsd: z.string().refine(v => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Must be a non-negative number"),
  treasuryAddress: z.string().min(32, "Valid Solana address required (32+ characters)"),
  referralPoolPercentage: z.number().min(0, "Must be 0 or greater").max(20, "Cannot exceed 20%"),
}).refine(
  (data) => new Date(data.startTime) < new Date(data.endTime),
  {
    message: "End time must be after start time",
    path: ["endTime"],
  }
).refine(
  (data) => parseFloat(data.maxPerTxUsd) <= parseFloat(data.maxPerWalletUsd),
  {
    message: "Max per transaction cannot exceed max per wallet",
    path: ["maxPerTxUsd"],
  }
).refine(
  (data) => parseFloat(data.minTxUsd) <= parseFloat(data.maxPerTxUsd),
  {
    message: "Minimum transaction cannot exceed maximum transaction",
    path: ["minTxUsd"],
  }
);

type CreateEventFormData = z.infer<typeof createEventSchema>;

export function CreateFairMintForm() {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [adminWallet, setAdminWallet] = useState<string | null>(null);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [isAuthorized, setIsAuthorized] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    watch,
    setError,
    clearErrors,
  } = useForm<CreateEventFormData>({
    resolver: zodResolver(createEventSchema),
    defaultValues: {
      eventName: "SOLF Proof-of-Burn Fair Mint",
      description: "A 72-hour Fair Mint where users burn admin-approved SPL tokens (no LPs) and receive SOLF pro-rata by USD value at burn time. No presale, no insiders.",
      tgePercentage: 20,
      vestingDays: 30,
      platformFeeBps: 150,
      maxPerWalletUsd: "5000",
      maxPerTxUsd: "2500",
      quoteTtlSeconds: 90,
      minTxUsd: "20",
      referralPoolPercentage: 3,
      acceptedTokens: [
        { 
          mintAddress: "", 
          tokenName: "", 
          tokenSymbol: "", 
          dailyCapUsd: "250000",
          dexPriceSource: ""
        }
      ]
    },
  });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "acceptedTokens",
  });

  const watchedValues = watch();

  // Check admin authorization
  useEffect(() => {
    const checkAdminAuth = async () => {
      try {
        if (!publicKey) {
          setIsAuthorized(false);
          setAdminCheckLoading(false);
          return;
        }

        // Check if the fairmint service is available
        if (!backend || !backend.fairmint || typeof backend.fairmint.getAdminWallet !== 'function') {
          console.error('Fair mint service not available on backend client');
          setIsAuthorized(false);
          setAdminCheckLoading(false);
          toast({
            title: "Service Error",
            description: "Fair mint service is not available. Please check if the backend is running.",
            variant: "destructive",
          });
          return;
        }

        const response = await backend.fairmint.getAdminWallet();
        setAdminWallet(response.adminWallet);
        setIsAuthorized(publicKey.toString() === response.adminWallet);
      } catch (error) {
        console.error('Failed to check admin authorization:', error);
        setIsAuthorized(false);
        toast({
          title: "Authorization Check Failed",
          description: "Could not verify admin status. Please try refreshing the page.",
          variant: "destructive",
        });
      } finally {
        setAdminCheckLoading(false);
      }
    };

    checkAdminAuth();
  }, [publicKey, toast]);

  // Set default dates (24 hours from now for start, 96 hours from now for end)
  useEffect(() => {
    const now = new Date();
    const defaultStart = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours from now
    const defaultEnd = new Date(now.getTime() + 96 * 60 * 60 * 1000); // 96 hours from now (72-hour duration)
    
    const startTime = defaultStart.toISOString().slice(0, 16);
    const endTime = defaultEnd.toISOString().slice(0, 16);
    
    // Set default values if not already set
    if (!watchedValues.startTime) {
      register('startTime', { value: startTime });
    }
    if (!watchedValues.endTime) {
      register('endTime', { value: endTime });
    }
  }, [register, watchedValues.startTime, watchedValues.endTime]);

  const onSubmit = async (data: CreateEventFormData) => {
    if (!publicKey || !isAuthorized) {
      toast({ 
        title: "Unauthorized", 
        description: "You are not authorized to create fair mint events.", 
        variant: "destructive" 
      });
      return;
    }

    // Additional client-side validation
    const now = new Date();
    const startTime = new Date(data.startTime);
    const endTime = new Date(data.endTime);

    if (startTime <= new Date(now.getTime() + 300000)) { // 5 minutes buffer
      setError('startTime', { message: 'Start time must be at least 5 minutes in the future' });
      return;
    }

    if (endTime <= startTime) {
      setError('endTime', { message: 'End time must be after start time' });
      return;
    }

    // Check for duplicate mint addresses
    const mintAddresses = data.acceptedTokens.map(t => t.mintAddress.toLowerCase());
    const uniqueMints = new Set(mintAddresses);
    if (mintAddresses.length !== uniqueMints.size) {
      toast({
        title: "Duplicate Tokens",
        description: "Duplicate mint addresses found. Each token must be unique.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    clearErrors();

    try {
      const payload = {
        adminWallet: publicKey.toString(),
        eventName: data.eventName.trim(),
        description: data.description?.trim(),
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        acceptedTokens: data.acceptedTokens.map(token => ({
          mintAddress: token.mintAddress.trim(),
          tokenName: token.tokenName.trim(),
          tokenSymbol: token.tokenSymbol.trim().toUpperCase(),
          tokenLogoUrl: token.tokenLogoUrl?.trim() || undefined,
          dailyCapUsd: token.dailyCapUsd,
          dexPriceSource: token.dexPriceSource?.trim() || undefined,
        })),
        tgePercentage: data.tgePercentage,
        vestingDays: data.vestingDays,
        platformFeeBps: data.platformFeeBps,
        maxPerWalletUsd: data.maxPerWalletUsd,
        maxPerTxUsd: data.maxPerTxUsd,
        quoteTtlSeconds: data.quoteTtlSeconds,
        minTxUsd: data.minTxUsd,
        treasuryAddress: data.treasuryAddress.trim(),
        referralPoolPercentage: data.referralPoolPercentage,
      };

      const response = await backend.fairmint.createEvent(payload);

      toast({
        title: "Fair Mint Event Created Successfully! 🔥",
        description: `Event "${response.event.eventName}" is now active with ${response.acceptedTokens.length} SPL tokens. Starting ${new Date(response.event.startTime).toLocaleString()}.`,
      });

    } catch (error) {
      console.error('Failed to create event:', error);
      
      let errorMessage = "An unknown error occurred.";
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      toast({
        title: "Creation Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (adminCheckLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Checking authorization...</span>
      </div>
    );
  }

  if (!publicKey) {
    return (
      <Alert>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          Please connect your wallet to access the admin panel.
        </AlertDescription>
      </Alert>
    );
  }

  if (!isAuthorized) {
    return (
      <Alert variant="destructive">
        <Shield className="h-4 w-4" />
        <AlertDescription>
          You are not authorized to create fair mint events. Your wallet: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
          {adminWallet && (
            <div className="mt-2 text-xs">
              Expected admin wallet: {adminWallet.slice(0, 8)}...{adminWallet.slice(-8)}
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Shield className="h-5 w-5 text-green-500" />
          <span>Create New Proof-of-Burn Fair Mint Event</span>
        </CardTitle>
        <CardDescription>
          Configure and launch a new SPL token burning event. All existing active events will be deactivated.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
          {/* Authorization Status */}
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              ✅ Authorized as admin: {publicKey.toString().slice(0, 8)}...{publicKey.toString().slice(-8)}
            </AlertDescription>
          </Alert>

          {/* General Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">General Details</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="eventName">Event Name *</Label>
                <Input 
                  id="eventName" 
                  {...register('eventName')} 
                  className={errors.eventName ? 'border-destructive' : ''}
                />
                {errors.eventName && <p className="text-sm text-destructive">{errors.eventName.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea 
                  id="description" 
                  {...register('description')}
                  className={errors.description ? 'border-destructive' : ''}
                />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="startTime">Start Time (Local) *</Label>
                <Input 
                  id="startTime" 
                  type="datetime-local" 
                  {...register('startTime')}
                  className={errors.startTime ? 'border-destructive' : ''}
                />
                {errors.startTime && <p className="text-sm text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="endTime">End Time (Local) *</Label>
                <Input 
                  id="endTime" 
                  type="datetime-local" 
                  {...register('endTime')}
                  className={errors.endTime ? 'border-destructive' : ''}
                />
                {errors.endTime && <p className="text-sm text-destructive">{errors.endTime.message}</p>}
              </div>
            </div>
          </div>

          {/* SPL Token Requirements Info */}
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <Info className="h-5 w-5 text-blue-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">SPL Token Requirements</h4>
                  <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>Only standard SPL tokens (no LP tokens or Token-2022 variants)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>Must have active price feeds or reliable DEX data</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>No transfer fees or unusual token mechanics</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>Verified and audited tokens only</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Accepted SPL Tokens */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Accepted SPL Tokens ({fields.length}/20)</h3>
            {fields.map((field, index) => (
              <div key={field.id} className="p-4 border rounded-lg space-y-4 relative">
                {fields.length > 1 && (
                  <Button 
                    type="button" 
                    variant="destructive" 
                    size="icon" 
                    className="absolute top-2 right-2 h-8 w-8" 
                    onClick={() => remove(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label>SPL Mint Address *</Label>
                    <Input 
                      {...register(`acceptedTokens.${index}.mintAddress`)} 
                      placeholder="e.g., So11111111111111111111111111111111111111112"
                      className={errors.acceptedTokens?.[index]?.mintAddress ? 'border-destructive' : ''}
                    />
                    {errors.acceptedTokens?.[index]?.mintAddress && (
                      <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.mintAddress?.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Token Name *</Label>
                    <Input 
                      {...register(`acceptedTokens.${index}.tokenName`)} 
                      placeholder="e.g., Wrapped SOL"
                      className={errors.acceptedTokens?.[index]?.tokenName ? 'border-destructive' : ''}
                    />
                    {errors.acceptedTokens?.[index]?.tokenName && (
                      <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.tokenName?.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Token Symbol *</Label>
                    <Input 
                      {...register(`acceptedTokens.${index}.tokenSymbol`)} 
                      placeholder="e.g., SOL"
                      className={errors.acceptedTokens?.[index]?.tokenSymbol ? 'border-destructive' : ''}
                    />
                    {errors.acceptedTokens?.[index]?.tokenSymbol && (
                      <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.tokenSymbol?.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Logo URL (optional)</Label>
                    <Input 
                      {...register(`acceptedTokens.${index}.tokenLogoUrl`)} 
                      placeholder="https://..."
                      className={errors.acceptedTokens?.[index]?.tokenLogoUrl ? 'border-destructive' : ''}
                    />
                    {errors.acceptedTokens?.[index]?.tokenLogoUrl && (
                      <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.tokenLogoUrl?.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Daily Cap (USD) *</Label>
                    <Input 
                      type="number" 
                      {...register(`acceptedTokens.${index}.dailyCapUsd`)} 
                      placeholder="250000"
                      className={errors.acceptedTokens?.[index]?.dailyCapUsd ? 'border-destructive' : ''}
                    />
                    {errors.acceptedTokens?.[index]?.dailyCapUsd && (
                      <p className="text-sm text-destructive">{errors.acceptedTokens[index]?.dailyCapUsd?.message}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>DEX Price Source (optional)</Label>
                    <Input 
                      {...register(`acceptedTokens.${index}.dexPriceSource`)} 
                      placeholder="jupiter, raydium, etc."
                    />
                  </div>
                </div>
              </div>
            ))}
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => append({ 
                mintAddress: "", 
                tokenName: "", 
                tokenSymbol: "", 
                dailyCapUsd: "250000",
                dexPriceSource: ""
              })}
              disabled={fields.length >= 20}
            >
              <Plus className="mr-2 h-4 w-4" /> Add SPL Token ({fields.length}/20)
            </Button>
            {errors.acceptedTokens && <p className="text-sm text-destructive">{errors.acceptedTokens.message}</p>}
          </div>

          {/* Burn Limits & Caps */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Burn Limits & Caps</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>Max Per Wallet (USD) *</Label>
                <Input 
                  type="number" 
                  {...register('maxPerWalletUsd')}
                  className={errors.maxPerWalletUsd ? 'border-destructive' : ''}
                />
                {errors.maxPerWalletUsd && <p className="text-sm text-destructive">{errors.maxPerWalletUsd.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Max Per Transaction (USD) *</Label>
                <Input 
                  type="number" 
                  {...register('maxPerTxUsd')}
                  className={errors.maxPerTxUsd ? 'border-destructive' : ''}
                />
                {errors.maxPerTxUsd && <p className="text-sm text-destructive">{errors.maxPerTxUsd.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Min Per Transaction (USD) *</Label>
                <Input 
                  type="number" 
                  {...register('minTxUsd')}
                  className={errors.minTxUsd ? 'border-destructive' : ''}
                />
                {errors.minTxUsd && <p className="text-sm text-destructive">{errors.minTxUsd.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Quote TTL (seconds) *</Label>
                <Input 
                  type="number" 
                  {...register('quoteTtlSeconds', { valueAsNumber: true })}
                  className={errors.quoteTtlSeconds ? 'border-destructive' : ''}
                />
                {errors.quoteTtlSeconds && <p className="text-sm text-destructive">{errors.quoteTtlSeconds.message}</p>}
              </div>
            </div>
          </div>

          {/* Tokenomics & Vesting */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Tokenomics & Vesting</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label>TGE Release (%) *</Label>
                <Input 
                  type="number" 
                  {...register('tgePercentage', { valueAsNumber: true })}
                  className={errors.tgePercentage ? 'border-destructive' : ''}
                />
                {errors.tgePercentage && <p className="text-sm text-destructive">{errors.tgePercentage.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Vesting Period (days) *</Label>
                <Input 
                  type="number" 
                  {...register('vestingDays', { valueAsNumber: true })}
                  className={errors.vestingDays ? 'border-destructive' : ''}
                />
                {errors.vestingDays && <p className="text-sm text-destructive">{errors.vestingDays.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Platform Fee (bps) *</Label>
                <Input 
                  type="number" 
                  {...register('platformFeeBps', { valueAsNumber: true })}
                  className={errors.platformFeeBps ? 'border-destructive' : ''}
                />
                {errors.platformFeeBps && <p className="text-sm text-destructive">{errors.platformFeeBps.message}</p>}
              </div>
              <div className="space-y-2">
                <Label>Referral Pool (%) *</Label>
                <Input 
                  type="number" 
                  {...register('referralPoolPercentage', { valueAsNumber: true })}
                  className={errors.referralPoolPercentage ? 'border-destructive' : ''}
                />
                {errors.referralPoolPercentage && <p className="text-sm text-destructive">{errors.referralPoolPercentage.message}</p>}
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Treasury Address *</Label>
                <Input 
                  {...register('treasuryAddress')} 
                  placeholder="Solana wallet address"
                  className={errors.treasuryAddress ? 'border-destructive' : ''}
                />
                {errors.treasuryAddress && <p className="text-sm text-destructive">{errors.treasuryAddress.message}</p>}
              </div>
            </div>
          </div>

          {/* Launch Warning */}
          <Card className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-amber-800 dark:text-amber-200">Pre-Launch Checklist</h4>
                  <div className="text-sm text-amber-700 dark:text-amber-300 mt-2 space-y-1">
                    <p>• All SPL tokens verified and price feeds configured</p>
                    <p>• Treasury address confirmed and secure</p>
                    <p>• Quote TTL and caps appropriate for expected volume</p>
                    <p>• Emergency pause functionality tested</p>
                    <p>• All existing active events will be deactivated</p>
                    <p>• Start time must be at least 5 minutes in the future</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button type="submit" disabled={isSubmitting || !isAuthorized} className="w-full" size="lg">
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating SPL Burn Event...
              </>
            ) : (
              'Launch Fair Mint Event'
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
