import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, Users, Coins, TrendingUp, Clock } from 'lucide-react';
import backend from '~backend/client';

interface TokenStatsDialogProps {
  token: {
    mintAddress: string;
    name: string;
    symbol: string;
  };
}

export function TokenStatsDialog({ token }: TokenStatsDialogProps) {
  const [open, setOpen] = useState(false);

  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['tokenStats', token.mintAddress],
    queryFn: async () => {
      const response = await backend.token.getStats({ mintAddress: token.mintAddress });
      return response;
    },
    enabled: open,
  });

  const { data: mintHistory } = useQuery({
    queryKey: ['mintHistory', token.mintAddress],
    queryFn: async () => {
      const response = await backend.token.getMintHistory({ 
        mintAddress: token.mintAddress,
        limit: 5 
      });
      return response;
    },
    enabled: open,
  });

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-1">
          <BarChart3 className="h-3 w-3" />
          <span>Stats</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Token Statistics</DialogTitle>
          <DialogDescription>
            Detailed analytics for {token.name} ({token.symbol})
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Failed to load token statistics</p>
            </div>
          ) : stats && (
            <>
              {/* Overview Cards */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Coins className="h-4 w-4 text-blue-500" />
                    <span className="text-sm font-medium">Total Supply</span>
                  </div>
                  <p className="text-2xl font-bold">{Number(stats.totalSupply).toLocaleString()}</p>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-green-500" />
                    <span className="text-sm font-medium">Minted</span>
                  </div>
                  <p className="text-2xl font-bold">{Number(stats.totalMinted).toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">{stats.percentageMinted}% of supply</p>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Users className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium">Holders</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.uniqueHolders}</p>
                </div>

                <div className="bg-muted rounded-lg p-4">
                  <div className="flex items-center space-x-2 mb-2">
                    <Clock className="h-4 w-4 text-orange-500" />
                    <span className="text-sm font-medium">Total Mints</span>
                  </div>
                  <p className="text-2xl font-bold">{stats.totalMints}</p>
                </div>
              </div>

              {/* Token Status */}
              <div className="space-y-3">
                <h4 className="font-medium">Token Status</h4>
                <div className="flex items-center space-x-2">
                  <Badge variant={stats.isMintable ? "default" : "secondary"}>
                    {stats.isMintable ? "Mintable" : "Minting Disabled"}
                  </Badge>
                  <Badge variant={stats.isFrozen ? "destructive" : "default"}>
                    {stats.isFrozen ? "Frozen" : "Active"}
                  </Badge>
                </div>
              </div>

              {/* Supply Progress */}
              <div className="space-y-3">
                <h4 className="font-medium">Supply Progress</h4>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Minted: {Number(stats.totalMinted).toLocaleString()}</span>
                    <span>Remaining: {Number(stats.remainingSupply).toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${stats.percentageMinted}%` }}
                    />
                  </div>
                  <p className="text-xs text-center text-muted-foreground">
                    {stats.percentageMinted}% of total supply minted
                  </p>
                </div>
              </div>

              {/* Recent Mint History */}
              {mintHistory && mintHistory.mints.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-medium">Recent Mint Activity</h4>
                  <div className="space-y-2">
                    {mintHistory.mints.map((mint) => (
                      <div key={mint.id} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <div>
                          <p className="text-sm font-medium">
                            {Number(mint.amount).toLocaleString()} {token.symbol}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            To: {formatAddress(mint.recipientAddress)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-muted-foreground">
                            {formatDate(mint.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                    {mintHistory.total > 5 && (
                      <p className="text-xs text-center text-muted-foreground">
                        Showing 5 of {mintHistory.total} total mints
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Token Details */}
              <div className="space-y-3">
                <h4 className="font-medium">Token Details</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Created:</span>
                    <p className="font-medium">{formatDate(stats.createdAt)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Mint Address:</span>
                    <p className="font-mono text-xs">{formatAddress(stats.mintAddress)}</p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
