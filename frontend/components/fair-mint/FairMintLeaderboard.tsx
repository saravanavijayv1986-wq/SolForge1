import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Trophy, Users, Coins, TrendingUp, Crown, Medal, Award } from 'lucide-react';
import backend from '~backend/client';

interface LeaderboardEntry {
  rank: number;
  userWallet: string;
  totalUsdBurned: string;
  totalSolfAllocated: string;
  transactionCount: number;
  lastBurnTimestamp: Date;
}

interface TokenLeaderboardEntry {
  tokenSymbol: string;
  tokenName: string;
  totalUsdBurned: string;
  transactionCount: number;
  participantCount: number;
  averageBurnUsd: string;
}

export function FairMintLeaderboard() {
  const [activeTab, setActiveTab] = useState('users');

  const { data: userLeaderboard, isLoading: isLoadingUsers } = useQuery({
    queryKey: ['fairMintLeaderboard'],
    queryFn: async () => {
      const response = await backend.fairMint.getLeaderboard({});
      return response;
    },
  });

  const { data: tokenLeaderboard, isLoading: isLoadingTokens } = useQuery({
    queryKey: ['fairMintTokenLeaderboard'],
    queryFn: async () => {
      const response = await backend.fairMint.getTokenLeaderboard({});
      return response;
    },
  });

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    }
    return `$${num.toFixed(2)}`;
  };

  const formatNumber = (amount: string) => {
    const num = parseFloat(amount);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="text-muted-foreground font-bold">#{rank}</span>;
    }
  };

  const getRankBadge = (rank: number) => {
    switch (rank) {
      case 1:
        return <Badge className="bg-yellow-100 text-yellow-800 border-yellow-200">🥇 #1</Badge>;
      case 2:
        return <Badge className="bg-gray-100 text-gray-800 border-gray-200">🥈 #2</Badge>;
      case 3:
        return <Badge className="bg-amber-100 text-amber-800 border-amber-200">🥉 #3</Badge>;
      default:
        return <Badge variant="outline">#{rank}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Trophy className="h-5 w-5" />
          <span>Fair Mint Leaderboard</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="users" className="flex items-center space-x-2">
              <Users className="h-4 w-4" />
              <span>Top Burners</span>
            </TabsTrigger>
            <TabsTrigger value="tokens" className="flex items-center space-x-2">
              <Coins className="h-4 w-4" />
              <span>Token Stats</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="space-y-4">
            {isLoadingUsers ? (
              <div className="space-y-3">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-48" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : !userLeaderboard?.entries || userLeaderboard.entries.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Users className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Participants Yet</h3>
                <p className="text-muted-foreground">
                  Be the first to burn tokens and claim the top spot!
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {userLeaderboard.entries.map((entry) => (
                  <div
                    key={entry.userWallet}
                    className={`flex items-center space-x-3 p-3 border rounded-lg transition-colors ${
                      entry.rank <= 3 
                        ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950' 
                        : 'border-border hover:bg-muted/50'
                    }`}
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-8 h-8">
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-mono text-sm">
                          {formatAddress(entry.userWallet)}
                        </span>
                        {getRankBadge(entry.rank)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.transactionCount} burns • Last: {new Date(entry.lastBurnTimestamp).toLocaleDateString()}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="font-semibold text-sm">
                        {formatCurrency(entry.totalUsdBurned)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(entry.totalSolfAllocated)} SOLF
                      </div>
                    </div>
                  </div>
                ))}

                {userLeaderboard.hasMore && (
                  <div className="text-center pt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing top {userLeaderboard.entries.length} of {userLeaderboard.total} participants
                    </p>
                  </div>
                )}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tokens" className="space-y-4">
            {isLoadingTokens ? (
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
                    <Skeleton className="w-8 h-8 rounded-full" />
                    <div className="flex-1 space-y-1">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-3 w-32" />
                    </div>
                    <Skeleton className="h-4 w-16" />
                  </div>
                ))}
              </div>
            ) : !tokenLeaderboard?.entries || tokenLeaderboard.entries.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Coins className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">No Burns Yet</h3>
                <p className="text-muted-foreground">
                  Token burn statistics will appear here once the fair mint begins.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {tokenLeaderboard.entries.map((entry, index) => (
                  <div
                    key={entry.tokenSymbol}
                    className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    {/* Rank */}
                    <div className="flex items-center justify-center w-8 h-8 bg-muted rounded-full">
                      <span className="text-sm font-bold">#{index + 1}</span>
                    </div>

                    {/* Token Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="font-semibold">{entry.tokenSymbol}</span>
                        <Badge variant="outline">{entry.tokenName}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.participantCount} burners • Avg: {formatCurrency(entry.averageBurnUsd)}
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="text-right">
                      <div className="font-semibold text-sm">
                        {formatCurrency(entry.totalUsdBurned)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {entry.transactionCount} burns
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
