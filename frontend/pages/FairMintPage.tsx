import React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Flame, Info, AlertTriangle, CheckCircle, DollarSign, RefreshCw, Shield, Clock } from 'lucide-react';
import { FairMintCountdown } from '../components/fair-mint/FairMintCountdown';
import { AcceptedTokensGrid } from '../components/fair-mint/AcceptedTokensGrid';
import { BurnQuoteCard } from '../components/fair-mint/BurnQuoteCard';
import { FairMintLeaderboard } from '../components/fair-mint/FairMintLeaderboard';
import { UserDashboard } from '../components/fair-mint/UserDashboard';
import { useWallet } from '../providers/WalletProvider';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import backend from '~backend/client';

export function FairMintPage() {
  const { connected, publicKey } = useWallet();
  const queryClient = useQueryClient();

  const { data: eventData, isLoading, isRefetching } = useQuery({
    queryKey: ['fairMintActiveEvent'],
    queryFn: async () => {
      const response = await backend.fairMint.getActiveEvent();
      return response;
    },
  });

  const { data: eventStats } = useQuery({
    queryKey: ['fairMintEventStats', eventData?.event?.id],
    queryFn: async () => {
      if (!eventData?.event?.id) return null;
      const response = await backend.fairMint.getEventStats({ eventId: eventData.event.id });
      return response;
    },
    enabled: !!eventData?.event?.id,
  });

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['fairMintActiveEvent'] });
    queryClient.invalidateQueries({ queryKey: ['fairMintEventStats'] });
    queryClient.invalidateQueries({ queryKey: ['fairMintUserBurns'] });
    queryClient.invalidateQueries({ queryKey: ['fairMintLeaderboard'] });
    queryClient.invalidateQueries({ queryKey: ['fairMintTokenLeaderboard'] });
  };

  const handleBurnSuccess = () => {
    handleRefresh();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <Skeleton className="h-10 w-96 mb-2" />
            <Skeleton className="h-6 w-[500px]" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <Skeleton className="h-64" />
              <Skeleton className="h-96" />
            </div>
            <div className="space-y-8">
              <Skeleton className="h-64" />
              <Skeleton className="h-96" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!eventData?.event) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-foreground mb-2">
              <span className="flex items-center space-x-2">
                <Flame className="h-8 w-8 text-orange-500" />
                <span>Proof-of-Burn Fair Mint (SPL-only → SOLF)</span>
              </span>
            </h1>
            <p className="text-muted-foreground">
              A 72-hour Fair Mint where users burn admin-approved SPL tokens (no LPs) and receive SOLF pro-rata by USD value at burn time
            </p>
          </div>

          <Card className="max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Info className="h-5 w-5 text-blue-500" />
                <span>No Active Fair Mint</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  <Flame className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  Fair Mint Coming Soon
                </h3>
                <p className="text-muted-foreground mb-6">
                  There is no active fair mint event at the moment. Stay tuned for announcements about upcoming events!
                </p>

                {/* How It Works */}
                <div className="text-left space-y-6 max-w-2xl mx-auto">
                  <h4 className="font-semibold text-lg">How Proof-of-Burn Fair Mint Works:</h4>
                  
                  <div className="space-y-4 text-sm text-muted-foreground">
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">Connect wallet and burn approved SPL tokens</span>
                        <p className="text-xs mt-1">Only curated SPL tokens accepted - no LP tokens or transfers</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">Receive SOLF pro-rata by USD value burned</span>
                        <p className="text-xs mt-1">Allocation based on USD value at time of burn using live Pyth pricing</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">True on-chain burns via SPL Token Program</span>
                        <p className="text-xs mt-1">Never transfers - tokens are permanently destroyed from supply</p>
                      </div>
                    </div>
                    
                    <div className="flex items-start space-x-3">
                      <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                      <div>
                        <span className="font-medium text-foreground">Fair distribution with vesting</span>
                        <p className="text-xs mt-1">20% at TGE, 80% linear vest over 30 days (configurable)</p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <h5 className="font-medium mb-3">Default Launch Parameters:</h5>
                    <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
                      <div>• 72-hour burn window</div>
                      <div>• 90-second quote TTL</div>
                      <div>• $2,500 max per transaction</div>
                      <div>• $5,000 max per wallet</div>
                      <div>• $250k daily cap per token</div>
                      <div>• $20 minimum burn</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Global Security Warning */}
        <Card className="mb-6 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Shield className="h-5 w-5 text-red-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-red-800 dark:text-red-200">Never send tokens to a wallet address</h4>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  Burns happen on-chain via the SPL burn instruction from your account. We will never ask you to transfer tokens to any address. If you see a wallet address request, stop and report it.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground mb-2">
              <span className="flex items-center space-x-2">
                <Flame className="h-8 w-8 text-orange-500" />
                <span>Proof-of-Burn Fair Mint (SPL-only → SOLF)</span>
              </span>
            </h1>
            <p className="text-muted-foreground">
              {eventData.event.description || "A 72-hour Fair Mint where users burn admin-approved SPL tokens and receive SOLF pro-rata by USD value"}
            </p>
          </div>
          <Button onClick={handleRefresh} variant="outline" disabled={isRefetching}>
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        {/* Fair Mint Rules */}
        <Card className="mb-8 border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="pt-6">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-3">Core Fair Mint Rules</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700 dark:text-blue-300">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>SPL-only burns (curated list, no LPs)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>True burn via SPL Token Program</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>USD value locks at burn time</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                      <span>Pro-rata allocation by USD burned</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4 text-blue-500" />
                      <span>90-second quote TTL</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      <span>Max ${parseFloat(eventData.event.maxPerTxUsd).toLocaleString()} per tx</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      <span>Max ${parseFloat(eventData.event.maxPerWalletUsd).toLocaleString()} per wallet</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <DollarSign className="h-4 w-4 text-blue-500" />
                      <span>Min ${parseFloat(eventData.event.minTxUsd)} per burn</span>
                    </div>
                  </div>
                </div>
                
                <div className="mt-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    <strong>Vesting:</strong> {eventData.event.tgePercentage}% at TGE (Token Generation Event), {100 - eventData.event.tgePercentage}% linear vest over {eventData.event.vestingDays} days
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Countdown and Stats */}
            <FairMintCountdown
              startTime={eventData.event.startTime}
              endTime={eventData.event.endTime}
              status={eventData.status}
              timeRemaining={eventData.timeRemaining}
              totalUsdBurned={eventStats?.totalUsdBurned || '0'}
              totalParticipants={eventStats?.totalParticipants || 0}
            />

            {/* Accepted Tokens */}
            <AcceptedTokensGrid
              tokens={eventData.acceptedTokens}
              isLive={eventData.isLive}
            />

            {/* User Dashboard */}
            {connected && publicKey && eventData.event && (
              <UserDashboard userWallet={publicKey.toString()} eventId={eventData.event.id} />
            )}

            {/* Leaderboard */}
            <FairMintLeaderboard />
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Burn Interface */}
            {connected ? (
              <BurnQuoteCard
                tokens={eventData.acceptedTokens}
                isLive={eventData.isLive}
                userWallet={publicKey?.toString()}
                onBurnSuccess={handleBurnSuccess}
              />
            ) : (
              <Card className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertTriangle className="h-5 w-5 text-orange-500" />
                    <span>Wallet Required</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-orange-700 dark:text-orange-300 mb-4">
                    Connect your Solana wallet to participate in the fair mint.
                  </p>
                  <div className="text-center">
                    <WalletConnectPrompt />
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Event Stats Summary */}
            {eventStats && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <DollarSign className="h-5 w-5" />
                    <span>Event Stats</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Burned:</span>
                      <span className="font-medium">${Number(eventStats.totalUsdBurned).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Participants:</span>
                      <span className="font-medium">{eventStats.totalParticipants.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Total Burns:</span>
                      <span className="font-medium">{eventStats.totalTransactions.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Avg. Burn:</span>
                      <span className="font-medium">${Number(eventStats.averageBurnUsd).toFixed(2)}</span>
                    </div>
                  </div>

                  {eventData.status === 'finalized' && eventData.event.solfPerUsdRate && (
                    <div className="pt-3 border-t">
                      <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                        <p className="text-sm text-purple-700 dark:text-purple-300 mb-1">Final Rate</p>
                        <p className="font-bold text-purple-800 dark:text-purple-200">
                          1 USD = {parseFloat(eventData.event.solfPerUsdRate).toLocaleString()} SOLF
                        </p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* FAQ */}
            <Card>
              <CardHeader>
                <CardTitle>Frequently Asked Questions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold text-sm mb-1">How is allocation decided?</h4>
                  <p className="text-xs text-muted-foreground">
                    By the USD value of your SPL burn at the time of burn (fresh quote with 90s TTL).
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Are there refunds?</h4>
                  <p className="text-xs text-muted-foreground">
                    None—burns are final and irreversible. Tokens are permanently destroyed from supply.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Why no burn address?</h4>
                  <p className="text-xs text-muted-foreground">
                    Transfers aren't burns. We use the SPL burn instruction to destroy supply permanently.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">When do I receive SOLF?</h4>
                  <p className="text-xs text-muted-foreground">
                    After Finalize sets SOLF per $1. {eventData.event.tgePercentage}% at claim, {100 - eventData.event.tgePercentage}% over {eventData.event.vestingDays} days.
                  </p>
                </div>
                <div>
                  <h4 className="font-semibold text-sm mb-1">Are there limits?</h4>
                  <p className="text-xs text-muted-foreground">
                    Yes—per-tx, per-wallet, and per-token daily caps are shown in-app and enforced on-chain.
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
