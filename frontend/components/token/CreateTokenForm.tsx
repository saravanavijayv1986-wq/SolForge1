import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Upload, X, DollarSign, AlertTriangle, Globe } from 'lucide-react';
import { useWallet } from '../../providers/WalletProvider';
import { TOKEN_CREATION_FEE, NETWORK_CONFIG } from '../../config';
import { Transaction } from '@solana/web3.js';
import { parseSolanaError, formatSolanaError } from '../../utils/solana-errors';
import backend from '~backend/client';

const createTokenSchema = z.object({
  name: z.string()
    .min(1, 'Token name is required')
    .max(32, 'Token name must be 32 characters or less')
    .refine((val) => val.trim().length > 0, 'Token name cannot be empty'),
  symbol: z.string()
    .min(1, 'Token symbol is required')
    .max(10, 'Token symbol must be 10 characters or less')
    .refine((val) => val.trim().length > 0, 'Token symbol cannot be empty')
    .refine((val) => /^[A-Z0-9]+$/.test(val.toUpperCase()), 'Token symbol can only contain letters and numbers'),
  decimals: z.number()
    .min(0, 'Decimals must be 0 or greater')
    .max(9, 'Decimals must be 9 or less')
    .int('Decimals must be a whole number'),
  supply: z.string()
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0 && num <= 1e15;
    }, 'Supply must be a positive number less than 1,000,000,000,000,000'),
  description: z.string()
    .max(500, 'Description must be 500 characters or less')
    .optional(),
  isMintable: z.boolean().default(true),
});

type CreateTokenFormData = z.infer<typeof createTokenSchema>;

export function CreateTokenForm() {
  const navigate = useNavigate();
  const { publicKey, wallet } = useWallet();
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [payingFee, setPayingFee] = useState(false);
  const [uploadingMetadata, setUploadingMetadata] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<CreateTokenFormData>({
    resolver: zodResolver(createTokenSchema),
    defaultValues: {
      decimals: 6,
      supply: '1000000',
      isMintable: true,
    },
    mode: 'onChange',
  });

  const handleLogoUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ title: "Invalid File", description: "Please upload an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File Too Large", description: "Please upload an image smaller than 5MB.", variant: "destructive" });
      return;
    }

    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (e) => setLogoPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const removeLogo = () => {
    setLogoFile(null);
    setLogoPreview(null);
    const fileInput = document.getElementById('logo-upload') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  };

  const onSubmit = async (data: CreateTokenFormData) => {
    if (!publicKey || !wallet) {
      toast({ title: "Wallet Not Connected", description: "Please connect your wallet.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    setPayingFee(true);

    try {
      // Step 1: Create fee transaction
      const feeTransactionResponse = await backend.wallet.createFeeTransaction({
        fromAddress: publicKey.toString(),
      });

      // Step 2: Get user to sign the fee transaction
      const feeTransaction = Transaction.from(Buffer.from(feeTransactionResponse.transaction, 'base64'));
      const signedFeeTransaction = await wallet.signTransaction(feeTransaction);

      // Step 3: Process the fee payment
      const feePaymentResponse = await backend.wallet.processFee({
        fromAddress: publicKey.toString(),
        signedTransaction: signedFeeTransaction.serialize().toString('base64'),
      });

      if (!feePaymentResponse.success) {
        throw new Error("Fee payment failed");
      }

      setPayingFee(false);
      setUploadingMetadata(true);

      toast({
        title: "Fee Payment Successful",
        description: `Paid ${TOKEN_CREATION_FEE} SOL creation fee. Uploading metadata to Arweave...`,
      });

      // Step 4: Create the token with fee proof and metadata upload
      let logoFileBase64: string | undefined;
      if (logoFile) {
        logoFileBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read logo file'));
          reader.readAsDataURL(logoFile);
        });
      }

      const response = await backend.token.create({
        ...data,
        name: data.name.trim(),
        symbol: data.symbol.trim().toUpperCase(),
        supply: data.supply.trim(),
        description: data.description?.trim(),
        logoFile: logoFileBase64,
        creatorWallet: publicKey.toString(),
        feeTransactionSignature: feePaymentResponse.transactionSignature,
      });

      setUploadingMetadata(false);

      toast({
        title: "Token Created Successfully!",
        description: `Your token ${data.symbol.toUpperCase()} has been deployed to ${NETWORK_CONFIG.displayName} with metadata stored on Arweave.`,
      });

      // Show metadata URLs if available
      if (response.metadataUrl) {
        toast({
          title: "Metadata Uploaded",
          description: "Token metadata has been permanently stored on Arweave.",
        });
      }

      setTimeout(() => navigate('/dashboard'), 2000);
    } catch (error) {
      console.error('Failed to create token:', error);
      
      const solanaError = parseSolanaError(error);
      const formattedError = formatSolanaError(solanaError);
      
      toast({ 
        title: formattedError.title, 
        description: formattedError.description, 
        variant: "destructive" 
      });
    } finally {
      setIsSubmitting(false);
      setPayingFee(false);
      setUploadingMetadata(false);
    }
  };

  const watchedValues = watch();

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        {/* Fee Notice */}
        <Card className="mb-6 border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <DollarSign className="h-5 w-5 text-orange-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-orange-800 dark:text-orange-200">Token Creation Fee</h4>
                <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                  A one-time fee of {TOKEN_CREATION_FEE} SOL is required to create a token on {NETWORK_CONFIG.displayName}. 
                  This covers network costs, platform maintenance, and Arweave storage.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Arweave Storage Notice */}
        <Card className="mb-6 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Globe className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-200">Permanent Metadata Storage</h4>
                <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                  Your token's metadata and images will be permanently stored on Arweave, ensuring they remain 
                  accessible forever and cannot be censored or removed.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Token Details</CardTitle>
            <CardDescription>Enter the details for your new SPL token. Fields with * are required.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Token Name *</Label>
                  <Input id="name" placeholder="e.g., My Awesome Token" {...register('name')} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="symbol">Token Symbol *</Label>
                  <Input id="symbol" placeholder="e.g., MAT" {...register('symbol', { onChange: (e) => e.target.value = e.target.value.toUpperCase() })} style={{ textTransform: 'uppercase' }} />
                  {errors.symbol && <p className="text-sm text-destructive">{errors.symbol.message}</p>}
                </div>
              </div>

              {/* Supply and Decimals */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="supply">Total Supply *</Label>
                  <Input id="supply" type="number" placeholder="1000000" {...register('supply')} />
                  {errors.supply && <p className="text-sm text-destructive">{errors.supply.message}</p>}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="decimals">Decimals *</Label>
                  <Input id="decimals" type="number" {...register('decimals', { valueAsNumber: true })} />
                  {errors.decimals && <p className="text-sm text-destructive">{errors.decimals.message}</p>}
                </div>
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea id="description" placeholder="Describe your token (optional)" {...register('description')} />
                {errors.description && <p className="text-sm text-destructive">{errors.description.message}</p>}
                <p className="text-xs text-muted-foreground">This will be included in the token's metadata on Arweave</p>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Token Logo (Optional)</Label>
                <div className="flex items-center gap-4">
                  {logoPreview ? (
                    <div className="relative">
                      <img src={logoPreview} alt="Logo preview" className="w-16 h-16 rounded-lg object-cover" />
                      <Button type="button" variant="destructive" size="icon" onClick={removeLogo} className="absolute -top-2 -right-2 w-6 h-6"><X className="h-4 w-4" /></Button>
                    </div>
                  ) : (
                    <div className="w-16 h-16 border-2 border-dashed rounded-lg flex items-center justify-center"><Upload className="h-6 w-6 text-muted-foreground" /></div>
                  )}
                  <div>
                    <Button type="button" variant="outline" onClick={() => document.getElementById('logo-upload')?.click()}>Choose Logo</Button>
                    <input id="logo-upload" type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, GIF up to 5MB</p>
                    <p className="text-xs text-muted-foreground">Will be stored permanently on Arweave</p>
                  </div>
                </div>
              </div>

              {/* Token Settings */}
              <div className="space-y-2">
                <Label>Token Settings</Label>
                <div className="flex items-center justify-between p-3 border rounded-lg">
                  <div>
                    <Label htmlFor="mintable">Allow Future Minting</Label>
                    <p className="text-xs text-muted-foreground">Enable ability to mint more tokens after creation.</p>
                  </div>
                  <Switch id="mintable" checked={watchedValues.isMintable} onCheckedChange={(checked) => setValue('isMintable', checked)} />
                </div>
              </div>

              {/* Mainnet Warning */}
              <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CardContent className="pt-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-semibold text-green-800 dark:text-green-200">{NETWORK_CONFIG.displayName} Deployment</h4>
                      <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                        This token will be deployed to {NETWORK_CONFIG.displayName} with metadata permanently stored on Arweave. 
                        Make sure all details are correct. Real SOL will be charged for the creation fee.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button type="submit" disabled={isSubmitting} className="w-full" size="lg">
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {payingFee ? `Paying ${TOKEN_CREATION_FEE} SOL Fee...` : 
                     uploadingMetadata ? 'Uploading to Arweave...' : 'Creating Token...'}
                  </>
                ) : (
                  `Create Token (${TOKEN_CREATION_FEE} SOL)`
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      {/* Preview */}
      <div className="lg:col-span-1">
        <Card className="sticky top-8">
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden">
                  {logoPreview ? <img src={logoPreview} alt="Token logo" className="w-full h-full object-cover" /> : <span className="text-white font-bold">{watchedValues.symbol?.charAt(0)?.toUpperCase() || '?'}</span>}
                </div>
                <div>
                  <h3 className="font-semibold text-lg">{watchedValues.name || 'Token Name'}</h3>
                  <p className="text-sm text-muted-foreground">{watchedValues.symbol?.toUpperCase() || 'SYMBOL'}</p>
                </div>
              </div>
              <div className="space-y-3 pt-4 border-t">
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Supply:</span><span className="font-medium">{watchedValues.supply ? Number(watchedValues.supply).toLocaleString() : '0'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Decimals:</span><span className="font-medium">{watchedValues.decimals ?? 6}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Mintable:</span><span className="font-medium">{watchedValues.isMintable ? 'Yes' : 'No'}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Network:</span><span className="font-medium text-green-600">{NETWORK_CONFIG.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Storage:</span><span className="font-medium text-blue-600">Arweave</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Creation Fee:</span><span className="font-medium">{TOKEN_CREATION_FEE} SOL</span></div>
                {watchedValues.description && <div className="pt-2"><span className="text-sm text-muted-foreground">Description:</span><p className="text-sm mt-1">{watchedValues.description}</p></div>}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
