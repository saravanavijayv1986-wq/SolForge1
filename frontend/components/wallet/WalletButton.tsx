import React from 'react';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { Wallet, Copy, LogOut, Loader2, ChevronDown } from 'lucide-react';
import { useWallet, WalletType } from '../../providers/WalletProvider';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';

export function WalletButton() {
  const { connected, connecting, publicKey, walletType, connect, disconnect, availableWallets } = useWallet();
  const { toast } = useToast();

  const handleConnect = async (selectedWalletType?: WalletType) => {
    try {
      await connect(selectedWalletType);
      const walletName = getWalletDisplayName(selectedWalletType || walletType);
      toast({
        title: "Wallet Connected",
        description: `Successfully connected to your ${walletName} wallet.`,
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      toast({
        title: "Connection Failed",
        description: error instanceof Error ? error.message : "Failed to connect to wallet.",
        variant: "destructive",
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await disconnect();
      toast({
        title: "Wallet Disconnected",
        description: "Successfully disconnected from your wallet.",
      });
    } catch (error) {
      console.error('Failed to disconnect wallet:', error);
    }
  };

  const copyAddress = () => {
    if (publicKey) {
      navigator.clipboard.writeText(publicKey.toString());
      toast({
        title: "Address Copied",
        description: "Wallet address copied to clipboard.",
      });
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const getWalletDisplayName = (type: WalletType | null) => {
    switch (type) {
      case 'phantom':
        return 'Phantom';
      case 'solflare':
        return 'Solflare';
      default:
        return 'Wallet';
    }
  };

  const getWalletIcon = (type: WalletType) => {
    // You could return different icons here for different wallets
    return <Wallet className="h-4 w-4" />;
  };

  if (connecting) {
    return (
      <Button disabled className="flex items-center space-x-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span>Connecting...</span>
      </Button>
    );
  }

  if (!connected || !publicKey) {
    // If only one wallet is available, connect directly
    if (availableWallets.length === 1) {
      return (
        <Button onClick={() => handleConnect(availableWallets[0])} className="flex items-center space-x-2">
          <Wallet className="h-4 w-4" />
          <span>Connect {getWalletDisplayName(availableWallets[0])}</span>
        </Button>
      );
    }

    // If multiple wallets are available, show dropdown
    if (availableWallets.length > 1) {
      return (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="flex items-center space-x-2">
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet</span>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuLabel>Choose Wallet</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {availableWallets.map((wallet) => (
              <DropdownMenuItem
                key={wallet}
                onClick={() => handleConnect(wallet)}
                className="flex items-center space-x-2"
              >
                {getWalletIcon(wallet)}
                <span>Connect {getWalletDisplayName(wallet)}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      );
    }

    // No wallets available
    return (
      <Button disabled className="flex items-center space-x-2">
        <Wallet className="h-4 w-4" />
        <span>No Wallet Found</span>
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="flex items-center space-x-2">
          <Wallet className="h-4 w-4" />
          <span>{formatAddress(publicKey.toString())}</span>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          Connected via {getWalletDisplayName(walletType)}
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={copyAddress} className="flex items-center space-x-2">
          <Copy className="h-4 w-4" />
          <span>Copy Address</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleDisconnect} className="flex items-center space-x-2 text-destructive">
          <LogOut className="h-4 w-4" />
          <span>Disconnect</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
