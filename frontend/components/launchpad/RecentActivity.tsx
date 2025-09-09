import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Activity, ExternalLink } from 'lucide-react';
import backend from '~backend/client';

export function RecentActivity() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['recentPurchases'],
    queryFn: async () => {
      const response = await backend.launchpad.getRecentPurchases({
        limit: 10,
      });
      return response;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatDate = (date: string | Date) => {
    const now = new Date();
    const purchaseDate = new Date(date);
    const diffMs = now.getTime() - purchaseDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {
      return 'Just now';
    } else if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return `${diffDays}d ago`;
    }
  };

  const formatNumber = (value: string) => {
    const num = parseFloat(value);
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(1)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(1)}K`;
    }
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Activity className="h-5 w-5" />
          <span>Recent Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="space-y-1">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-32" />
                </div>
                <Skeleton className="h-4 w-16" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-8">
            <p className="text-muted-foreground">Failed to load recent activity</p>
          </div>
        ) : !data?.purchases || data.purchases.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Activity className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No activity yet</h3>
            <p className="text-muted-foreground">Recent SOLF purchases will appear here</p>
          </div>
        ) : (
          <div className="space-y-3">
            {data.purchases.map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                <div className="space-y-1">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-sm">{formatAddress(purchase.wallet)}</span>
                    <Badge variant="outline" className="text-xs">
                      {formatNumber(purchase.solfPaid)} SOLF
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(purchase.solSent)} SOL • {formatDate(purchase.createdAt)}
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => window.open(`https://explorer.solana.com/tx/${purchase.txSig}`, '_blank')}
                    className="p-1 hover:bg-muted rounded transition-colors"
                  >
                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
