import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Upload, Image, Globe, Twitter, MessageSquare, Hash, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useTokenWizard } from '../../providers/TokenWizardProvider';

const metadataSchema = z.object({
  description: z.string().optional(),
  website: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  twitter: z.string().optional(),
  telegram: z.string().optional(),
  discord: z.string().optional(),
});

type MetadataFormData = z.infer<typeof metadataSchema>;

export function MetadataStep() {
  const { formData, updateFormData } = useTokenWizard();
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string>('');
  const { toast } = useToast();

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
  } = useForm<MetadataFormData>({
    resolver: zodResolver(metadataSchema),
    defaultValues: {
      description: formData.description || '',
      website: formData.website || '',
      twitter: formData.twitter || '',
      telegram: formData.telegram || '',
      discord: formData.discord || '',
    },
  });

  const watchedValues = watch();

  React.useEffect(() => {
    updateFormData({
      ...watchedValues,
      logoFile,
      logoUrl: logoPreview,
    });
  }, [watchedValues, logoFile, logoPreview, updateFormData]);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file
    if (!file.type.startsWith('image/')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload an image file (PNG, JPG, GIF, etc.)",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      toast({
        title: "File Too Large",
        description: "Image must be smaller than 5MB",
        variant: "destructive",
      });
      return;
    }

    setLogoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onload = (e) => {
      setLogoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);

    toast({
      title: "Image Selected",
      description: "Your logo has been selected for token creation",
    });
  };

  const removeImage = () => {
    setLogoFile(null);
    setLogoPreview('');
    updateFormData({
      logoFile: undefined,
      logoUrl: undefined,
    });
  };

  const formatSocialHandle = (value: string, platform: string) => {
    if (!value) return '';
    
    // Remove @ symbol and URLs
    let cleaned = value.replace(/^@/, '').replace(/^https?:\/\/[^\/]+\//, '');
    
    // Platform specific cleaning
    if (platform === 'twitter') {
      cleaned = cleaned.replace(/^(twitter\.com\/|x\.com\/)/, '');
    } else if (platform === 'telegram') {
      cleaned = cleaned.replace(/^(t\.me\/|telegram\.me\/)/, '');
    } else if (platform === 'discord') {
      // Discord can be server invite or username
      cleaned = cleaned.replace(/^(discord\.gg\/|discord\.com\/invite\/)/, '');
    }
    
    return cleaned;
  };

  return (
    <div className="space-y-6">
      {/* Logo Upload */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Image className="h-5 w-5" />
            <span>Token Logo</span>
          </CardTitle>
          <CardDescription>
            Upload an image to represent your token (optional)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!logoPreview ? (
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">Upload Token Logo</h3>
              <p className="text-muted-foreground mb-4">
                PNG, JPG, GIF up to 5MB. Recommended: 512x512px
              </p>
              <div className="flex justify-center">
                <label htmlFor="logo-upload">
                  <Button variant="outline" className="cursor-pointer">
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File
                  </Button>
                </label>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileUpload}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 rounded-lg overflow-hidden border">
                <img 
                  src={logoPreview} 
                  alt="Token logo preview" 
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Logo Preview</h4>
                <p className="text-sm text-muted-foreground">
                  {logoFile?.name} ({((logoFile?.size || 0) / 1024).toFixed(1)} KB)
                </p>
                <Badge className="mt-2 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                  Ready for token creation
                </Badge>
              </div>
              <Button variant="outline" onClick={removeImage}>
                Remove
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your token's purpose, utility, and vision..."
          rows={4}
          {...register('description')}
          className={errors.description ? 'border-destructive' : ''}
        />
        {errors.description && (
          <p className="text-sm text-destructive flex items-center space-x-1">
            <AlertTriangle className="h-3 w-3" />
            <span>{errors.description.message}</span>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          A brief description of your token project (optional)
        </p>
      </div>

      {/* Website */}
      <div className="space-y-2">
        <Label htmlFor="website">Website</Label>
        <div className="relative">
          <Globe className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            id="website"
            type="url"
            placeholder="https://yourproject.com"
            {...register('website')}
            className={`pl-10 ${errors.website ? 'border-destructive' : ''}`}
          />
        </div>
        {errors.website && (
          <p className="text-sm text-destructive flex items-center space-x-1">
            <AlertTriangle className="h-3 w-3" />
            <span>{errors.website.message}</span>
          </p>
        )}
      </div>

      {/* Social Links */}
      <Card>
        <CardHeader>
          <CardTitle>Social Links</CardTitle>
          <CardDescription>
            Connect your social media profiles (all optional)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Twitter */}
          <div className="space-y-2">
            <Label htmlFor="twitter">Twitter/X</Label>
            <div className="relative">
              <Twitter className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="twitter"
                placeholder="@username or https://twitter.com/username"
                {...register('twitter')}
                className="pl-10"
                onChange={(e) => {
                  const formatted = formatSocialHandle(e.target.value, 'twitter');
                  e.target.value = formatted;
                }}
              />
            </div>
          </div>

          {/* Telegram */}
          <div className="space-y-2">
            <Label htmlFor="telegram">Telegram</Label>
            <div className="relative">
              <MessageSquare className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="telegram"
                placeholder="@username or https://t.me/username"
                {...register('telegram')}
                className="pl-10"
                onChange={(e) => {
                  const formatted = formatSocialHandle(e.target.value, 'telegram');
                  e.target.value = formatted;
                }}
              />
            </div>
          </div>

          {/* Discord */}
          <div className="space-y-2">
            <Label htmlFor="discord">Discord</Label>
            <div className="relative">
              <Hash className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                id="discord"
                placeholder="Server invite or username"
                {...register('discord')}
                className="pl-10"
                onChange={(e) => {
                  const formatted = formatSocialHandle(e.target.value, 'discord');
                  e.target.value = formatted;
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      {(watchedValues.description || watchedValues.website || logoPreview) && (
        <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Metadata Preview</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-4">
              {logoPreview && (
                <div className="w-16 h-16 rounded-lg overflow-hidden border">
                  <img 
                    src={logoPreview} 
                    alt="Token logo" 
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-lg">
                  {formData.name || 'Token Name'}
                </h3>
                <div className="flex items-center space-x-2 mb-2">
                  <Badge variant="secondary">{formData.symbol || 'SYMBOL'}</Badge>
                  {watchedValues.website && (
                    <a 
                      href={watchedValues.website} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-500"
                    >
                      <Globe className="h-4 w-4" />
                    </a>
                  )}
                </div>
                {watchedValues.description && (
                  <p className="text-sm text-muted-foreground">
                    {watchedValues.description}
                  </p>
                )}
                <div className="flex items-center space-x-3 mt-2">
                  {watchedValues.twitter && (
                    <span className="text-xs text-muted-foreground">
                      Twitter: @{watchedValues.twitter}
                    </span>
                  )}
                  {watchedValues.telegram && (
                    <span className="text-xs text-muted-foreground">
                      Telegram: @{watchedValues.telegram}
                    </span>
                  )}
                  {watchedValues.discord && (
                    <span className="text-xs text-muted-foreground">
                      Discord: {watchedValues.discord}
                    </span>
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
              <h4 className="font-semibold text-blue-800 dark:text-blue-200">Metadata Storage</h4>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Token metadata will be stored locally and can be updated later. 
                For permanent storage, consider uploading to IPFS or Arweave separately.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
