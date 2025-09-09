import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/components/ui/use-toast';
import { Loader2, Settings } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import backend from '~backend/client';

interface TokenManageDialogProps {
  token: {
    mintAddress: string;
    name: string;
    symbol: string;
    isMintable: boolean;
    isFrozen: boolean;
  };
  onUpdateSuccess: () => void;
}

export function TokenManageDialog({ token, onUpdateSuccess }: TokenManageDialogProps) {
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMintable, setIsMintable] = useState(token.isMintable);
  const [isFrozen, setIsFrozen] = useState(token.isFrozen);
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const hasChanges = isMintable !== token.isMintable || isFrozen !== token.isFrozen;

  const handleSubmit = async () => {
    if (!publicKey) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet to manage tokens.",
        variant: "destructive",
      });
      return;
    }

    if (!hasChanges) {
      setOpen(false);
      return;
    }

    setIsSubmitting(true);

    try {
      await backend.token.updateToken({
        mintAddress: token.mintAddress,
        updaterWallet: publicKey.toString(),
        isMintable,
        isFrozen,
      });

      toast({
        title: "Token Updated Successfully!",
        description: `Updated settings for ${token.symbol}`,
      });

      setOpen(false);
      onUpdateSuccess();
    } catch (error) {
      console.error('Failed to update token:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update token.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      // Reset to original values when closing
      setIsMintable(token.isMintable);
      setIsFrozen(token.isFrozen);
    }
    setOpen(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-1">
          <Settings className="h-3 w-3" />
          <span>Manage</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Manage {token.symbol}</DialogTitle>
          <DialogDescription>
            Configure token settings and permissions
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Token Info */}
          <div className="bg-muted rounded-lg p-4">
            <h4 className="font-medium mb-2">{token.name}</h4>
            <p className="text-sm text-muted-foreground">
              Symbol: {token.symbol} • Address: {token.mintAddress.slice(0, 4)}...{token.mintAddress.slice(-4)}
            </p>
          </div>

          {/* Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="mintable">Mintable</Label>
                <p className="text-xs text-muted-foreground">
                  Allow new tokens to be minted
                </p>
              </div>
              <Switch
                id="mintable"
                checked={isMintable}
                onCheckedChange={setIsMintable}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="frozen">Frozen</Label>
                <p className="text-xs text-muted-foreground">
                  Prevent all token operations
                </p>
              </div>
              <Switch
                id="frozen"
                checked={isFrozen}
                onCheckedChange={setIsFrozen}
              />
            </div>
          </div>

          {/* Warning Messages */}
          {!isMintable && (
            <div className="bg-orange-50 dark:bg-orange-950 border border-orange-200 dark:border-orange-800 rounded-lg p-3">
              <p className="text-sm text-orange-800 dark:text-orange-200">
                ⚠️ Disabling minting will permanently prevent new tokens from being created.
              </p>
            </div>
          )}

          {isFrozen && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-800 dark:text-red-200">
                🔒 Freezing will halt all token transfers and operations.
              </p>
            </div>
          )}

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
              onClick={handleSubmit}
              disabled={isSubmitting || !hasChanges}
              className="flex-1"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Token'
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
