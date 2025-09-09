import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { TrendingUp, Users, Coins, DollarSign, Activity, Clock } from 'lucide-react';
import backend from '~backend/client';

export function LaunchpadStats() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['launchpadStats'],
    queryFn: async () => {
      const response = await backend.launchpad.getStats();
      return response;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const formatNumber = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (isNaN(num)) return '0';
    
    if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    }
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 4
    });
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'Never';
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const statsData = [
    {
      title: 'Total SOL Raised',
      value: stats ? formatNumber(stats.totalSolReceived) : '0',
      suffix: 'SOL',
      icon: DollarSign,
      color: 'text-green-600',
      bgColor: 'bg-green-100 dark:bg-green-900'
    },
    {
      title: 'SOLF Distributed',
      value: stats ? formatNumber(stats.totalSolfDistributed) : '0',
      suffix: 'SOLF',
      icon: Coins,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100 dark:bg-blue-900'
    },
    {
      title: 'Total Purchases',
      value: stats ? stats.totalPurchases.toLocaleString() : '0',
      suffix: '',
      icon: Activity,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100 dark:bg-purple-900'
    },
    {
      title: 'Unique Wallets',
      value: stats ? stats.uniqueWallets.toLocaleString() : '0',
      suffix: '',
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100 dark:bg-orange-900'
    },
    {
      title: 'Fees Collected',
      value: stats ? formatNumber(stats.totalFeesCollected) : '0',
      suffix: 'SOL',
      icon: TrendingUp,
      color: 'text-red-600',
      bgColor: 'bg-red-100 dark:bg-red-900'
    },
    {
      title: 'Avg Purchase',
      value: stats ? formatNumber(stats.averagePurchaseSize) : '0',
      suffix: 'SOL',
      icon: Clock,
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-100 dark:bg-indigo-900'
    }
  ];

  if (error) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Failed to load launchpad statistics</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {statsData.map((stat, index) => {
          const Icon = stat.icon;
          
          return (
            <Card key={index}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between text-sm font-medium">
                  <span className="text-muted-foreground">{stat.title}</span>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${stat.bgColor}`}>
                    <Icon className={`h-4 w-4 ${stat.color}`} />
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {isLoading ? (
                  <Skeleton className="h-8 w-24" />
                ) : (
                  <div className="text-2xl font-bold">
                    {stat.value}
                    {stat.suffix && <span className="text-sm font-normal text-muted-foreground ml-1">{stat.suffix}</span>}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {stats?.lastPurchaseAt && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-sm text-muted-foreground">Last Purchase</p>
              <p className="text-lg font-semibold">{formatDate(stats.lastPurchaseAt)}</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
