import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Copy, Calendar, Coins, RefreshCw, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { TokenMintDialog } from './TokenMintDialog';
import { TokenManageDialog } from './TokenManageDialog';
import { TokenStatsDialog } from './TokenStatsDialog';
import { TokenTransferDialog } from './TokenTransferDialog';
import { TransferHistory } from './TransferHistory';
import type { TokenInfo } from '~backend/token/list';
import backend from '~backend/client';

interface TokenListProps {
  creatorWallet?: string;
  holderWallet?: string;
  showBalances?: boolean;
}

export function TokenList({ creatorWallet, holderWallet, showBalances }: TokenListProps) {
  const { toast } = useToast();

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['tokens', creatorWallet, holderWallet],
    queryFn: async () => {
      const response = await backend.token.list({
        creatorWallet,
        holderWallet,
        limit: 50,
      });
      return response;
    },
    enabled: !!(creatorWallet || holderWallet),
    retry: 3,
    retryDelay: 1000,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
    });
  };

  const formatAddress = (address: string) => {
    if (!address || address.length < 8) return address;
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatSupply = (supply: string, decimals: number) => {
    const num = Number(supply);
    if (num >= 1e9) {
      return `${(num / 1e9).toFixed(1)}B`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(1)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const isCreator = (token: TokenInfo) => {
    return creatorWallet && token.creatorWallet === creatorWallet;
  };

  const hasBalance = (token: TokenInfo) => {
    return token.userBalance && parseFloat(token.userBalance) > 0;
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="flex items-center space-x-4">
                <Skeleton className="w-12 h-12 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-4 w-20 ml-auto" />
                  <Skeleton className="h-4 w-16 ml-auto" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-8">
        <div className="mb-4">
          <p className="text-muted-foreground">Failed to load tokens</p>
          <p className="text-sm text-muted-foreground mt-1">
            {error instanceof Error ? error.message : 'An unexpected error occurred'}
          </p>
        </div>
        <Button onClick={() => refetch()} variant="outline" size="sm">
          Try Again
        </Button>
      </div>
    );
  }

  if (!data?.tokens || data.tokens.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
          <Coins className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {showBalances ? "No token holdings" : "No tokens yet"}
        </h3>
        <p className="text-muted-foreground mb-4">
          {showBalances 
            ? "You don't have any token balances yet"
            : "Create your first SPL token to get started with token management"
          }
        </p>
        {!showBalances && (
          <Button asChild>
            <a href="/create">Create Your First Token</a>
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-muted-foreground">
          {data.total} token{data.total !== 1 ? 's' : ''} found
        </p>
        <Button onClick={() => refetch()} variant="outline" size="sm" disabled={isRefetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
          {isRefetching ? 'Refreshing...' : 'Refresh'}
        </Button>
      </div>

      {data.tokens.map((token) => (
        <Card key={token.id} className="hover:shadow-md transition-shadow">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4 flex-1">
                {/* Token Logo */}
                <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                  {token.logoUrl ? (
                    <img 
                      src={token.logoUrl} 
                      alt={token.name} 
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                        const parent = target.parentElement;
                        if (parent) {
                          parent.innerHTML = `<span class="text-white font-bold text-lg">${token.symbol.charAt(0)}</span>`;
                        }
                      }}
                    />
                  ) : (
                    <span className="text-white font-bold text-lg">
                      {token.symbol.charAt(0)}
                    </span>
                  )}
                </div>

                {/* Token Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center space-x-2 mb-1">
                    <h3 className="font-semibold text-lg truncate">{token.name}</h3>
                    <Badge variant="secondary">{token.symbol}</Badge>
                    {!token.isMintable && <Badge variant="outline">Mint Disabled</Badge>}
                    {token.isFrozen && <Badge variant="destructive">Frozen</Badge>}
                    {token.metadataUrl && (
                      <Badge variant="outline" className="text-blue-600">
                        Arweave
                      </Badge>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-4 text-sm text-muted-foreground flex-wrap gap-y-1">
                    {showBalances && token.userBalance && (
                      <span className="font-medium text-foreground">
                        Balance: {formatSupply(token.userBalance, token.decimals)} {token.symbol}
                      </span>
                    )}
                    <span>Supply: {formatSupply(token.supply, token.decimals)}</span>
                    <span>Minted: {formatSupply(token.totalMinted, token.decimals)}</span>
                    <span>Decimals: {token.decimals}</span>
                    <div className="flex items-center space-x-1">
                      <Calendar className="h-3 w-3" />
                      <span>{formatDate(token.createdAt)}</span>
                    </div>
                  </div>

                  {token.description && (
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                      {token.description}
                    </p>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center space-x-2 flex-shrink-0 ml-4">
                <TokenStatsDialog token={token} />
                
                <TransferHistory mintAddress={token.mintAddress} />

                {showBalances && hasBalance(token) && (
                  <TokenTransferDialog token={token} onTransferSuccess={refetch} />
                )}
                
                {isCreator(token) && (
                  <>
                    <TokenMintDialog token={token} onMintSuccess={refetch} />
                    <TokenManageDialog token={token} onUpdateSuccess={refetch} />
                  </>
                )}

                {token.metadataUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(token.metadataUrl, '_blank')}
                    className="flex items-center space-x-1"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span className="hidden sm:inline">Metadata</span>
                  </Button>
                )}

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => copyToClipboard(token.mintAddress, 'Mint address')}
                  className="flex items-center space-x-1"
                >
                  <Copy className="h-3 w-3" />
                  <span className="hidden sm:inline">{formatAddress(token.mintAddress)}</span>
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}

      {data.hasMore && (
        <div className="text-center pt-4">
          <Button variant="outline">Load More Tokens</Button>
        </div>
      )}
    </div>
  );
}
