import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History, ExternalLink, Copy, RefreshCw } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '@solana/wallet-adapter-react';
import backend from '~backend/client';
import type { PurchaseRecord } from '~backend/launchpad/stats';

export function PurchaseHistory() {
  const { publicKey } = useWallet();
  const { toast } = useToast();
  const [showAll, setShowAll] = useState(false);

  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['userPurchaseHistory', publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey) return null;
      const response = await backend.launchpad.getUserHistory({
        wallet: publicKey.toString(),
        limit: showAll ? 100 : 5,
      });
      return response;
    },
    enabled: !!publicKey,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
    });
  };

  const formatAddress = (address: string) => {
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

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    });
  };

  if (!publicKey) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Purchase History</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            Connect your wallet to view purchase history
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <History className="h-5 w-5" />
            <span>Your Purchase History</span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-48" />
                </div>
                <div className="text-right space-y-2">
                  <Skeleton className="h-4 w-20" />
                  <Skeleton className="h-3 w-16" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load purchase history</p>
            <Button onClick={() => refetch()} variant="outline" size="sm" className="mt-2">
              Try Again
            </Button>
          </div>
        ) : !data?.purchases || data.purchases.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <History className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No purchases yet</h3>
            <p className="text-muted-foreground">
              Your SOLF purchase history will appear here
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Summary */}
            <div className="bg-muted rounded-lg p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Total Purchases:</span>
                  <p className="font-semibold">{data.purchaseCount}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total SOL Spent:</span>
                  <p className="font-semibold">{formatNumber(data.totalSolSpent)} SOL</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total SOLF Received:</span>
                  <p className="font-semibold">{formatNumber(data.totalSolfReceived)} SOLF</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Total Fees Paid:</span>
                  <p className="font-semibold">{formatNumber(data.totalFeesPaid)} SOL</p>
                </div>
              </div>
            </div>

            {/* Purchase List */}
            <div className="space-y-3">
              {data.purchases.map((purchase) => (
                <div key={purchase.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors">
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <Badge variant="default" className="text-xs">
                        Purchase #{purchase.id}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {formatDate(purchase.createdAt)}
                      </span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">{formatNumber(purchase.solfPaid)} SOLF</span>
                      <span className="text-muted-foreground"> for </span>
                      <span className="font-medium">{formatNumber(purchase.solSent)} SOL</span>
                      <span className="text-muted-foreground"> (+ {formatNumber(purchase.feePaid)} SOL fee)</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(purchase.txSig, 'Transaction signature')}
                      className="h-auto p-2"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => window.open(`https://explorer.solana.com/tx/${purchase.txSig}`, '_blank')}
                      className="h-auto p-2"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {!showAll && data.purchaseCount > 5 && (
              <div className="text-center pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAll(true)}
                >
                  Show All {data.purchaseCount} Purchases
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
