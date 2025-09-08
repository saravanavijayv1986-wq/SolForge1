import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { User, Flame, DollarSign, Coins, Clock, Copy } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import backend from '~backend/client';

interface UserBurn {
  id: number;
  tokenSymbol: string;
  tokenAmount: string;
  usdValueAtBurn: string;
  estimatedSolf: string;
  actualSolfAllocated?: string;
  transactionSignature: string;
  burnTimestamp: Date;
}

interface UserDashboardProps {
  userWallet: string;
  eventId: number;
}

export function UserDashboard({ userWallet, eventId }: UserDashboardProps) {
  const { toast } = useToast();

  const { data: userBurns, isLoading } = useQuery({
    queryKey: ['fairMintUserBurns', userWallet, eventId],
    queryFn: async () => {
      const response = await backend.fairmint.getUserBurns({ userWallet, eventId });
      return response;
    },
    enabled: !!userWallet && !!eventId,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-6)}`;
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    return `$${num.toFixed(2)}`;
  };

  const formatNumber = (amount: string) => {
    const num = parseFloat(amount);
    return num.toLocaleString();
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Your Fair Mint Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-20" />
            ))}
          </div>
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!userBurns || userBurns.burns.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <User className="h-5 w-5" />
            <span>Your Fair Mint Activity</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Flame className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Burns Yet</h3>
            <p className="text-muted-foreground">
              Start burning SPL tokens to participate in the fair mint!
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <User className="h-5 w-5" />
          <span>Your Fair Mint Activity</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <DollarSign className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Total Burned</span>
            </div>
            <p className="text-xl font-bold">{formatCurrency(userBurns.totalUsdBurned)}</p>
          </div>
          
          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <Coins className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-medium">Est. SOLF</span>
            </div>
            <p className="text-xl font-bold">{formatNumber(userBurns.totalEstimatedSolf)}</p>
          </div>

          <div className="text-center p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-2">
              <Flame className="h-4 w-4 text-orange-500" />
              <span className="text-sm font-medium">Total Burns</span>
            </div>
            <p className="text-xl font-bold">{userBurns.burns.length}</p>
          </div>
        </div>

        {/* Burn History */}
        <div>
          <h4 className="font-semibold mb-3">Burn History</h4>
          <div className="space-y-3">
            {userBurns.burns.map((burn) => (
              <div
                key={burn.id}
                className="flex items-center justify-between p-3 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center">
                    <Flame className="h-5 w-5 text-white" />
                  </div>
                  
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium">{burn.tokenSymbol}</span>
                      <Badge variant="outline">{formatNumber(burn.tokenAmount)} tokens</Badge>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>{formatDate(burn.burnTimestamp)}</span>
                    </div>
                  </div>
                </div>

                <div className="text-right space-y-1">
                  <div className="font-semibold">{formatCurrency(burn.usdValueAtBurn)}</div>
                  <div className="text-sm text-muted-foreground">
                    Est: {formatNumber(burn.estimatedSolf)} SOLF
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(burn.transactionSignature, 'Transaction signature')}
                    className="h-auto p-1"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Info Box */}
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
            What happens next?
          </h4>
          <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
            <li>• Final SOLF allocations will be calculated when the event ends</li>
            <li>• You'll receive 20% of your SOLF immediately upon claiming</li>
            <li>• The remaining 80% will vest linearly over 30 days</li>
            <li>• Your allocation is locked based on your burn amounts and USD value</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}
