import React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, Lock, Flame, Snowflake, AlertTriangle, Info } from 'lucide-react';
import { useTokenWizard } from '../../providers/TokenWizardProvider';

const supplySettingsSchema = z.object({
  supplyType: z.enum(['fixed', 'mintable']),
  initialSupply: z.string()
    .min(1, 'Initial supply is required')
    .refine((val) => {
      const num = parseFloat(val);
      return !isNaN(num) && num > 0;
    }, 'Initial supply must be a positive number'),
  maxSupply: z.string().optional(),
  isBurnable: z.boolean(),
  hasFreezeAuthority: z.boolean(),
}).refine((data) => {
  if (data.supplyType === 'mintable' && data.maxSupply) {
    const initial = parseFloat(data.initialSupply);
    const max = parseFloat(data.maxSupply);
    return max >= initial;
  }
  return true;
}, {
  message: "Max supply must be greater than or equal to initial supply",
  path: ["maxSupply"]
});

type SupplySettingsFormData = z.infer<typeof supplySettingsSchema>;

export function SupplySettingsStep() {
  const { formData, updateFormData } = useTokenWizard();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
  } = useForm<SupplySettingsFormData>({
    resolver: zodResolver(supplySettingsSchema),
    defaultValues: {
      supplyType: formData.supplyType || 'fixed',
      initialSupply: formData.initialSupply || '',
      maxSupply: formData.maxSupply || '',
      isBurnable: formData.isBurnable || false,
      hasFreezeAuthority: formData.hasFreezeAuthority || false,
    },
  });

  const watchedValues = watch();

  React.useEffect(() => {
    updateFormData(watchedValues);
  }, [watchedValues, updateFormData]);

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (isNaN(num)) return '';
    return num.toLocaleString();
  };

  return (
    <div className="space-y-6">
      {/* Supply Type */}
      <div className="space-y-4">
        <Label className="text-base font-medium">Supply Type *</Label>
        <RadioGroup
          value={watchedValues.supplyType}
          onValueChange={(value: 'fixed' | 'mintable') => setValue('supplyType', value)}
          className="grid grid-cols-1 md:grid-cols-2 gap-4"
        >
          {/* Fixed Supply */}
          <Card className={`cursor-pointer transition-colors ${
            watchedValues.supplyType === 'fixed' 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
              : 'hover:border-border'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="fixed" id="fixed" />
                <Lock className="h-5 w-5 text-blue-500" />
                <div>
                  <CardTitle className="text-lg">Fixed Supply</CardTitle>
                  <CardDescription>Total supply is set at creation</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• No additional tokens can be minted</li>
                <li>• Mint authority is revoked permanently</li>
                <li>• Predictable scarcity model</li>
                <li>• Recommended for most tokens</li>
              </ul>
            </CardContent>
          </Card>

          {/* Mintable Supply */}
          <Card className={`cursor-pointer transition-colors ${
            watchedValues.supplyType === 'mintable' 
              ? 'border-blue-500 bg-blue-50 dark:bg-blue-950' 
              : 'hover:border-border'
          }`}>
            <CardHeader className="pb-3">
              <div className="flex items-center space-x-3">
                <RadioGroupItem value="mintable" id="mintable" />
                <Coins className="h-5 w-5 text-green-500" />
                <div>
                  <CardTitle className="text-lg">Mintable Supply</CardTitle>
                  <CardDescription>Can mint more tokens later</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• You retain mint authority</li>
                <li>• Can create more tokens later</li>
                <li>• Optional maximum supply cap</li>
                <li>• Flexible for growing projects</li>
              </ul>
            </CardContent>
          </Card>
        </RadioGroup>
      </div>

      {/* Supply Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Initial Supply */}
        <div className="space-y-2">
          <Label htmlFor="initialSupply">Initial Supply *</Label>
          <Input
            id="initialSupply"
            type="number"
            placeholder="1000000"
            {...register('initialSupply')}
            className={errors.initialSupply ? 'border-destructive' : ''}
          />
          {errors.initialSupply && (
            <p className="text-sm text-destructive flex items-center space-x-1">
              <AlertTriangle className="h-3 w-3" />
              <span>{errors.initialSupply.message}</span>
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Number of tokens to mint initially
            {watchedValues.initialSupply && (
              <span className="block font-medium">
                = {formatNumber(watchedValues.initialSupply)} tokens
              </span>
            )}
          </p>
        </div>

        {/* Max Supply */}
        {watchedValues.supplyType === 'mintable' && (
          <div className="space-y-2">
            <Label htmlFor="maxSupply">Maximum Supply (Optional)</Label>
            <Input
              id="maxSupply"
              type="number"
              placeholder="10000000"
              {...register('maxSupply')}
              className={errors.maxSupply ? 'border-destructive' : ''}
            />
            {errors.maxSupply && (
              <p className="text-sm text-destructive flex items-center space-x-1">
                <AlertTriangle className="h-3 w-3" />
                <span>{errors.maxSupply.message}</span>
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Maximum tokens that can ever exist
              {watchedValues.maxSupply && (
                <span className="block font-medium">
                  = {formatNumber(watchedValues.maxSupply)} tokens max
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Authority Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <span>Token Authorities</span>
          </CardTitle>
          <CardDescription>
            Configure additional token capabilities
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Burnable */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Flame className="h-4 w-4 text-orange-500" />
                <Label htmlFor="burnable" className="font-medium">Burnable Tokens</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Allow token holders to permanently destroy their tokens
              </p>
            </div>
            <Switch
              id="burnable"
              checked={watchedValues.isBurnable}
              onCheckedChange={(checked) => setValue('isBurnable', checked)}
            />
          </div>

          {/* Freeze Authority */}
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2">
                <Snowflake className="h-4 w-4 text-blue-500" />
                <Label htmlFor="freezeAuthority" className="font-medium">Freeze Authority</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                Ability to freeze/unfreeze token accounts (compliance feature)
              </p>
            </div>
            <Switch
              id="freezeAuthority"
              checked={watchedValues.hasFreezeAuthority}
              onCheckedChange={(checked) => setValue('hasFreezeAuthority', checked)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {watchedValues.initialSupply && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Supply Configuration Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <label className="text-muted-foreground">Supply Type</label>
                <p className="font-medium">
                  {watchedValues.supplyType === 'fixed' ? 'Fixed' : 'Mintable'}
                </p>
              </div>
              <div>
                <label className="text-muted-foreground">Initial Supply</label>
                <p className="font-medium">
                  {formatNumber(watchedValues.initialSupply)}
                </p>
              </div>
              {watchedValues.supplyType === 'mintable' && (
                <div>
                  <label className="text-muted-foreground">Max Supply</label>
                  <p className="font-medium">
                    {watchedValues.maxSupply ? formatNumber(watchedValues.maxSupply) : 'Unlimited'}
                  </p>
                </div>
              )}
              <div>
                <label className="text-muted-foreground">Features</label>
                <div className="flex flex-wrap gap-1">
                  {watchedValues.isBurnable && (
                    <Badge variant="outline" className="text-xs">Burnable</Badge>
                  )}
                  {watchedValues.hasFreezeAuthority && (
                    <Badge variant="outline" className="text-xs">Freezable</Badge>
                  )}
                  {!watchedValues.isBurnable && !watchedValues.hasFreezeAuthority && (
                    <span className="text-muted-foreground text-xs">None</span>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info */}
      <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
        <CardContent className="pt-6">
          <div className="flex items-start space-x-3">
            <Info className="h-5 w-5 text-blue-500 mt-0.5" />
            <div>
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">Supply Recommendations</h4>
              <ul className="text-sm text-blue-700 dark:text-blue-300 mt-1 space-y-1">
                <li>• Fixed supply is recommended for most tokens</li>
                <li>• Use mintable supply only if you need flexibility</li>
                <li>• Consider decimal places when setting supply amounts</li>
                <li>• Authority settings cannot be changed after creation</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
