import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, CheckCircle } from 'lucide-react';
import { useTokenWizard } from '../../providers/TokenWizardProvider';

const tokenInfoSchema = z.object({
  name: z.string()
    .min(1, 'Token name is required')
    .max(32, 'Name must be 32 characters or less')
    .regex(/^[a-zA-Z0-9\s-_]+$/, 'Name can only contain letters, numbers, spaces, hyphens, and underscores'),
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
    { value: 0, label: '0 - Whole numbers only', example: '1,000' },
    { value: 2, label: '2 - Like USD cents', example: '1,000.50' },
    { value: 6, label: '6 - Like USDC', example: '1,000.123456' },
    { value: 9, label: '9 - Like SOL (recommended)', example: '1,000.123456789' },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Token Name */}
        <div className="space-y-2">
          <Label htmlFor="name">Token Name *</Label>
          <Input
            id="name"
            placeholder="e.g. SolForge Token"
            {...register('name')}
            className={errors.name ? 'border-destructive' : ''}
          />
          {errors.name && (
            <p className="text-sm text-destructive flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{errors.name.message}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            The full name of your token (max 32 characters)
          </p>
        </div>

        {/* Token Symbol */}
        <div className="space-y-2">
          <Label htmlFor="symbol">Token Symbol *</Label>
          <Input
            id="symbol"
            placeholder="e.g. SOLF"
            {...register('symbol')}
            className={errors.symbol ? 'border-destructive' : ''}
            style={{ textTransform: 'uppercase' }}
            onChange={(e) => {
              setValue('symbol', e.target.value.toUpperCase());
            }}
          />
          {errors.symbol && (
            <p className="text-sm text-destructive flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{errors.symbol.message}</span>
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
                <div className="flex flex-col">
                  <span>{option.label}</span>
                  <span className="text-xs text-muted-foreground">Example: {option.example}</span>
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
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">
                  {watchedValues.symbol?.charAt(0) || 'T'}
                </span>
              </div>
              <div>
                <h3 className="font-semibold text-lg">{watchedValues.name}</h3>
                <div className="flex items-center space-x-2">
                  <Badge variant="secondary">{watchedValues.symbol}</Badge>
                  <span className="text-sm text-muted-foreground">
                    {watchedValues.decimals} decimals
                  </span>
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
              <span>Naming Guidelines</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <div>
              <h4 className="font-medium">Token Name</h4>
              <p className="text-muted-foreground">
                Choose a unique, descriptive name that represents your project
              </p>
            </div>
            <div>
              <h4 className="font-medium">Token Symbol</h4>
              <p className="text-muted-foreground">
                Keep it short, memorable, and avoid existing symbols
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center space-x-2">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span>Important Notes</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <ul className="space-y-1 text-muted-foreground">
              <li>• Name and symbol cannot be changed after creation</li>
              <li>• Decimals setting is permanent</li>
              <li>• Choose carefully as these are immutable</li>
              <li>• Check for existing tokens with similar names</li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
