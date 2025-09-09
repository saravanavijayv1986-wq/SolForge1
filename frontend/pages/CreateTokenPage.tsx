"use client";

import React, { useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useWallet } from "@solana/wallet-adapter-react";
import { useTokenService } from "../services/TokenService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/use-toast";
import { Loader2, ExternalLink, CheckCircle } from "lucide-react";
import { WalletConnectPrompt } from "../components/wallet/WalletConnectPrompt";
import { NETWORK_CONFIG } from "../config";

const createTokenSchema = z.object({
  name: z.string().min(1, "Token name is required"), // Not used by the service, but good for UX
  symbol: z.string().min(1, "Token symbol is required"), // Not used by the service
  decimals: z.number().min(0, "Must be at least 0").max(9, "Must be 9 or less"),
  initialSupply: z.string().refine(val => !val || !isNaN(parseFloat(val)), {
    message: "Must be a valid number",
  }).optional(),
  lockMintAuthority: z.boolean().default(false),
});

type FormValues = z.infer<typeof createTokenSchema>;

export function CreateTokenPage() {
  const { connected, publicKey } = useWallet();
  const { createToken } = useTokenService();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{ mint: string; signature: string } | null>(null);

  const { register, handleSubmit, control, formState: { errors }, reset } = useForm<FormValues>({
    resolver: zodResolver(createTokenSchema),
    defaultValues: { decimals: 9, lockMintAuthority: false },
  });

  const onSubmit = async (data: FormValues) => {
    if (!publicKey) {
      toast({ title: "Wallet not connected", variant: "destructive" });
      return;
    }
    setIsSubmitting(true);
    setResult(null);
    try {
      const res = await createToken({
        decimals: data.decimals,
        initialSupply: data.initialSupply ? Number(data.initialSupply) : undefined,
        lockMintAuthority: data.lockMintAuthority,
      });
      toast({
        title: "Token Created Successfully!",
        description: `Mint Address: ${res.mint}`,
      });
      setResult(res);
      reset();
    } catch (e: any) {
      console.error("Failed to create token:", e);
      toast({
        title: "Creation Failed",
        description: e.message || "An unexpected error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!connected) {
    return <WalletConnectPrompt />;
  }

  if (result) {
    return (
      <div className="max-w-lg mx-auto py-12">
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
            <CardTitle className="text-green-800 dark:text-green-200">Token Created!</CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              Your new SPL token has been deployed.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Mint Address:</span>
                <span className="font-mono text-xs">{result.mint}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Signature:</span>
                <span className="font-mono text-xs">{result.signature.slice(0,12)}...</span>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.open(`${NETWORK_CONFIG.explorerUrl}/tx/${result.signature}`, '_blank')}
              className="w-full flex items-center space-x-1"
            >
              <ExternalLink className="h-3 w-3" />
              <span>View on Explorer</span>
            </Button>
            <Button onClick={() => setResult(null)} className="w-full">
              Create Another Token
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto py-8">
      <Card>
        <CardHeader>
          <CardTitle>Create SPL Token</CardTitle>
          <CardDescription>
            Configure and deploy a new SPL token on {NETWORK_CONFIG.displayName}.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Name (for reference)</Label>
              <Input id="name" {...register("name")} placeholder="e.g. SolForge Token" />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="symbol">Symbol (for reference)</Label>
              <Input id="symbol" {...register("symbol")} placeholder="SOLF" />
              {errors.symbol && <p className="text-sm text-destructive">{errors.symbol.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="decimals">Decimals</Label>
              <Input id="decimals" type="number" min={0} max={9} {...register("decimals", { valueAsNumber: true })} />
              {errors.decimals && <p className="text-sm text-destructive">{errors.decimals.message}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="initialSupply">Initial Supply (optional)</Label>
              <Input id="initialSupply" type="text" {...register("initialSupply")} placeholder="e.g., 1000000" />
              {errors.initialSupply && <p className="text-sm text-destructive">{errors.initialSupply.message}</p>}
            </div>
            <div className="flex items-center space-x-2">
              <Controller
                name="lockMintAuthority"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="lockMintAuthority"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="lockMintAuthority">Lock mint authority (fixed supply)</Label>
            </div>
            <Button
              type="submit"
              disabled={!publicKey || isSubmitting}
              className="w-full"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : "Create Token"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
