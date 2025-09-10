import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, CheckCircle, Coins } from 'lucide-react';
import { useTokenWizard } from '../../providers/TokenWizardProvider';

const tokenInfoSchema = z.object({
  name: z.string()
    .min(1, 'Token name is required')
    .max(32, 'Name must be 32 characters or less')
    .regex(/^[a-zA-Z0-9\s\-_\.]+$/, 'Name can only contain letters, numbers, spaces, hyphens, underscores, and periods'),
  symbol: z.string()
    .min(1, 'Token symbol is required')
    .max(10, 'Symbol must be 10 characters or less')
    .regex(/^[A-Z0-9]+$/, 'Symbol must be uppercase letters and numbers only'),
  decimals: z.number()
    .min(0, 'Decimals must be at least 0')
    .max(9, 'Decimals must be 9 or less'),
});

type TokenInfoFormData = z.infer<typeof tokenInfoSchema>;

export function TokenInfoStep() {
  const { formData, updateFormData } = useTokenWizard();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<TokenInfoFormData>({
    resolver: zodResolver(tokenInfoSchema),
    defaultValues: {
      name: formData.name || '',
      symbol: formData.symbol || '',
      decimals: formData.decimals || 9,
    },
  });

  const watchedValues = watch();

  React.useEffect(() => {
    updateFormData(watchedValues);
  }, [watchedValues, updateFormData]);

  const commonDecimals = [
    { value: 0, label: '0 - Whole numbers only', example: '1,000', useCase: 'NFTs, collectibles' },
    { value: 2, label: '2 - Like USD cents', example: '1,000.50', useCase: 'Currencies, payments' },
    { value: 6, label: '6 - Like USDC', example: '1,000.123456', useCase: 'Stablecoins' },
    { value: 9, label: '9 - Like SOL (recommended)', example: '1,000.123456789', useCase: 'Most tokens' },
  ];

  const validateTokenName = (name: string) => {
    if (!name) return null;
    if (name.length < 3) return 'warning';
    if (name.length > 20) return 'warning';
    return 'success';
  };

  const validateTokenSymbol = (symbol: string) => {
    if (!symbol) return null;
    if (symbol.length < 2) return 'warning';
    if (symbol.length > 5) return 'warning';
    return 'success';
  };

  const nameValidation = validateTokenName(watchedValues.name);
  const symbolValidation = validateTokenSymbol(watchedValues.symbol);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Token Name *</Label>
          <div className="relative">
            <Input
              id="name"
              placeholder="e.g. SolForge Token"
              {...register('name')}
              className={`${errors.name ? 'border-destructive' : 
                nameValidation === 'success' ? 'border-green-500' :
                nameValidation === 'warning' ? 'border-yellow-500' : ''}`}
            />
            {nameValidation === 'success' && (
              <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
            )}
          </div>
          {errors.name && (
            <p className="text-sm text-destructive flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{errors.name.message}</span>
            </p>
          )}
          {!errors.name && nameValidation === 'warning' && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Recommended: 3-20 characters for better readability
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The full name of your token (max 32 characters)
          </p>
        </div>

        {/* Token Symbol */}
        <div className="space-y-2">
          <Label htmlFor="symbol">Token Symbol *</Label>
          <div className="relative">
            <Input
              id="symbol"
              placeholder="e.g. SOLF"
              {...register('symbol')}
              className={`${errors.symbol ? 'border-destructive' : 
                symbolValidation === 'success' ? 'border-green-500' :
                symbolValidation === 'warning' ? 'border-yellow-500' : ''}`}
              style={{ textTransform: 'uppercase' }}
              onChange={(e) => {
                setValue('symbol', e.target.value.toUpperCase());
              }}
            />
            {symbolValidation === 'success' && (
              <CheckCircle className="absolute right-3 top-3 h-4 w-4 text-green-500" />
            )}
          </div>
          {errors.symbol && (
            <p className="text-sm text-destructive flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{errors.symbol.message}</span>
            </p>
          )}
          {!errors.symbol && symbolValidation === 'warning' && (
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              Recommended: 2-5 characters for better recognition
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Short identifier for your token (max 10 characters, uppercase)
          </p>
        </div>
      </div>

      {/* Decimals */}
      <div className="space-y-2">
        <Label htmlFor="decimals">Decimals *</Label>
        <Select
          value={watchedValues.decimals?.toString()}
          onValueChange={(value) => setValue('decimals', parseInt(value))}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select decimal places" />
          </SelectTrigger>
          <SelectContent>
            {commonDecimals.map((option) => (
              <SelectItem key={option.value} value={option.value.toString()}>
                <div className="flex flex-col py-2">
                  <span className="font-medium">{option.label}</span>
                  <div className="text-xs text-muted-foreground space-y-1">
                    <div>Example: {option.example}</div>
                    <div>Use case: {option.useCase}</div>
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.decimals && (
          <p className="text-sm text-destructive flex items-center space-x-1">
            <AlertTriangle className="h-3 w-3" />
            <span>{errors.decimals.message}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Number of decimal places for your token. This cannot be changed after creation.
        </p>
      </div>

      {/* Preview */}
      {watchedValues.name && watchedValues.symbol && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Token Preview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-4">
              <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-xl">
                  {watchedValues.symbol?.charAt(0) || 'T'}
                </span>
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{watchedValues.name}</h3>
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="secondary" className="text-base px-3 py-1">
                    {watchedValues.symbol}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {watchedValues.decimals} decimals
                  </span>
                </div>
                <div className="text-sm text-muted-foreground">
                  1 {watchedValues.symbol} = 1.{'0'.repeat(watchedValues.decimals || 0)}1 base units
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span>Naming Best Practices</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div>
              <h4 className="font-medium mb-1">Token Name</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Use a descriptive, memorable name</li>
                <li>• Avoid copyrighted or trademarked terms</li>
                <li>• Consider your brand and project goals</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-1">Token Symbol</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Keep it short and recognizable</li>
                <li>• Check existing tokens for conflicts</li>
                <li>• Avoid common abbreviations</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <Coins className="h-4 w-4 text-purple-500" />
              <span>Decimal Precision</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-3">
            <div>
              <h4 className="font-medium mb-1">Why Decimals Matter</h4>
              <ul className="text-muted-foreground space-y-1">
                <li>• Higher decimals = more precision</li>
                <li>• 9 decimals is the Solana standard</li>
                <li>• Consider your token's use case</li>
                <li>• Cannot be changed after creation</li>
              </ul>
            </div>
            <div className="bg-blue-50 dark:bg-blue-950 p-3 rounded-lg">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 Most tokens use 9 decimals for compatibility with wallets and exchanges
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Important Notice */}
      <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-orange-800 dark:text-orange-200">
                Immutable Settings
              </h4>
              <p className="text-sm text-orange-700 dark:text-orange-300 mt-1">
                Token name, symbol, and decimals cannot be changed after creation. 
                Double-check these values before proceeding to the next step.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
