import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wallet, Download, ExternalLink } from 'lucide-react';
import { useWallet, WalletType } from '../../providers/WalletProvider';
import { useToast } from '@/components/ui/use-toast';

export function WalletConnectPrompt() {
  const { connect, connecting, availableWallets } = useWallet();
  const { toast } = useToast();

  const handleConnect = async (walletType?: WalletType) => {
    try {
      await connect(walletType);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to wallet.",
        variant: "destructive",
      });
    }
  };

  const getWalletDisplayName = (type: WalletType) => {
    switch (type) {
      case 'phantom':
        return 'Phantom';
      case 'solflare':
        return 'Solflare';
      default:
        return 'Wallet';
    }
  };

  const getWalletDownloadUrl = (type: WalletType) => {
    switch (type) {
      case 'phantom':
        return 'https://phantom.app/';
      case 'solflare':
        return 'https://solflare.com/';
      default:
        return '#';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Wallet className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-2xl">Connect Your Wallet</CardTitle>
            <CardDescription>
              Connect your Solana wallet to start creating and managing tokens
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Available Wallets */}
            {availableWallets.length > 0 ? (
              <div className="space-y-3">
                {availableWallets.map((walletType) => (
                  <Button
                    key={walletType}
                    onClick={() => handleConnect(walletType)}
                    disabled={connecting}
                    className="w-full flex items-center justify-center space-x-2"
                    size="lg"
                  >
                    <Wallet className="h-5 w-5" />
                    <span>
                      {connecting ? 'Connecting...' : `Connect ${getWalletDisplayName(walletType)}`}
                    </span>
                  </Button>
                ))}
              </div>
            ) : (
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  No Solana wallets detected. Please install a supported wallet:
                </p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full flex items-center space-x-2"
                  >
                    <a 
                      href="https://phantom.app/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Phantom</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    asChild
                    className="w-full flex items-center space-x-2"
                  >
                    <a 
                      href="https://solflare.com/" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="flex items-center space-x-2"
                    >
                      <Download className="h-4 w-4" />
                      <span>Download Solflare</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                </div>
              </div>
            )}

            {/* Wallet Download Options */}
            {availableWallets.length > 0 && (
              <div className="text-center pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-3">
                  Want to try a different wallet?
                </p>
                <div className="flex flex-col sm:flex-row gap-2">
                  {!availableWallets.includes('phantom') && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex items-center space-x-1"
                    >
                      <a 
                        href="https://phantom.app/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>Phantom</span>
                        <ExternalLink className="h-2 w-2" />
                      </a>
                    </Button>
                  )}
                  {!availableWallets.includes('solflare') && (
                    <Button
                      variant="outline"
                      size="sm"
                      asChild
                      className="flex items-center space-x-1"
                    >
                      <a 
                        href="https://solflare.com/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="flex items-center space-x-1"
                      >
                        <Download className="h-3 w-3" />
                        <span>Solflare</span>
                        <ExternalLink className="h-2 w-2" />
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            )}

            <div className="bg-muted rounded-lg p-4 text-sm text-muted-foreground">
              <h4 className="font-semibold mb-2">Why connect a wallet?</h4>
              <ul className="space-y-1 text-xs">
                <li>• Create and manage your SPL tokens</li>
                <li>• Sign transactions securely</li>
                <li>• Access your token history</li>
                <li>• Interact with the Solana blockchain</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
