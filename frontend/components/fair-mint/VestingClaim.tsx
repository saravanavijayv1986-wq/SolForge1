import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Coins, Clock, DollarSign, Loader2, CheckCircle, Calendar, TrendingUp, Gift } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';
import backend from '~backend/client';

interface VestingClaimProps {
  userWallet: string;
  eventId: number;
}

export function VestingClaim({ userWallet, eventId }: VestingClaimProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [claimType, setClaimType] = useState<'tge' | 'vesting' | 'both'>('both');

  const { data: claimableData, isLoading } = useQuery({
    queryKey: ['claimableAmount', userWallet, eventId],
    queryFn: async () => {
      const response = await backend.fairmint.getClaimableAmount({ userWallet, eventId });
      return response;
    },
    enabled: !!userWallet && !!eventId,
  });

  const { data: vestingSchedule } = useQuery({
    queryKey: ['vestingSchedule', userWallet, eventId],
    queryFn: async () => {
      const response = await backend.fairmint.getVestingSchedule({ userWallet, eventId });
      return response;
    },
    enabled: !!userWallet && !!eventId,
  });

  const claimMutation = useMutation({
    mutationFn: async (claimType: 'tge' | 'vesting' | 'both') => {
      const response = await backend.fairmint.claimTokens({
        userWallet,
        eventId,
        claimType,
      });
      return response;
    },
    onSuccess: (data) => {
      toast({
        title: "Tokens Claimed Successfully! 🎉",
        description: `Claimed ${parseFloat(data.totalClaimed).toLocaleString()} SOLF tokens. Transaction: ${data.transactionSignature.slice(0, 8)}...`,
      });
      
      // Refresh data
      queryClient.invalidateQueries({ queryKey: ['claimableAmount', userWallet, eventId] });
      queryClient.invalidateQueries({ queryKey: ['vestingSchedule', userWallet, eventId] });
    },
    onError: (error) => {
      console.error('Claim failed:', error);
      toast({
        title: "Claim Failed",
        description: error instanceof Error ? error.message : "Failed to claim tokens.",
        variant: "destructive",
      });
    },
  });

  const formatNumber = (amount: string) => {
    const num = parseFloat(amount);
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
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

  const handleClaim = () => {
    if (!claimableData) return;

    const claimableTge = parseFloat(claimableData.claimableTge);
    const claimableVesting = parseFloat(claimableData.claimableVesting);

    let finalClaimType: 'tge' | 'vesting' | 'both';
    
    if (claimableTge > 0 && claimableVesting > 0) {
      finalClaimType = 'both';
    } else if (claimableTge > 0) {
      finalClaimType = 'tge';
    } else if (claimableVesting > 0) {
      finalClaimType = 'vesting';
    } else {
      return; // Nothing to claim
    }

    claimMutation.mutate(finalClaimType);
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <span>SOLF Token Vesting</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!claimableData) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <span>SOLF Token Vesting</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Vesting Schedule</h3>
            <p className="text-muted-foreground">
              You don't have any SOLF tokens to claim from this event.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const totalClaimable = parseFloat(claimableData.totalClaimable);
  const hasClaimableTokens = totalClaimable > 0;
  const claimableTge = parseFloat(claimableData.claimableTge);
  const claimableVesting = parseFloat(claimableData.claimableVesting);

  return (
    <div className="space-y-6">
      {/* Main Vesting Card */}
      <Card className={hasClaimableTokens ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : ''}>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <span>SOLF Token Vesting</span>
            {hasClaimableTokens && (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                Claimable
              </Badge>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Allocation Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center space-x-1 mb-2">
                <DollarSign className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">Total Allocated</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(claimableData.totalAllocated)} SOLF</p>
            </div>
            
            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center space-x-1 mb-2">
                <Gift className="h-4 w-4 text-green-500" />
                <span className="text-sm font-medium">TGE (Immediate)</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(claimableData.tgeAmount)} SOLF</p>
              <p className="text-xs text-muted-foreground">
                Claimed: {formatNumber(claimableData.claimedTge)}
              </p>
            </div>

            <div className="text-center p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-center space-x-1 mb-2">
                <Clock className="h-4 w-4 text-purple-500" />
                <span className="text-sm font-medium">Vesting</span>
              </div>
              <p className="text-2xl font-bold">{formatNumber(claimableData.vestingAmount)} SOLF</p>
              <p className="text-xs text-muted-foreground">
                Claimed: {formatNumber(claimableData.claimedVesting)}
              </p>
            </div>
          </div>

          {/* Vesting Progress */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-medium flex items-center space-x-2">
                <TrendingUp className="h-4 w-4" />
                <span>Vesting Progress</span>
              </h4>
              <span className="text-sm text-muted-foreground">
                {claimableData.vestingProgress.toFixed(1)}% Complete
              </span>
            </div>
            
            <Progress value={claimableData.vestingProgress} className="h-3" />
            
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Vested: {formatNumber(
                (parseFloat(claimableData.vestingAmount) * (claimableData.vestingProgress / 100)).toString()
              )} SOLF</span>
              <span>
                {claimableData.isFullyVested ? 
                  'Fully Vested' : 
                  claimableData.nextVestingDate ? 
                    `Next: ${formatDate(claimableData.nextVestingDate)}` : 
                    'Vesting...'
                }
              </span>
            </div>
          </div>

          {/* Claimable Amounts */}
          {hasClaimableTokens && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    Ready to Claim: {formatNumber(claimableData.totalClaimable)} SOLF
                  </p>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    {claimableTge > 0 && (
                      <div>• TGE: {formatNumber(claimableData.claimableTge)} SOLF</div>
                    )}
                    {claimableVesting > 0 && (
                      <div>• Vesting: {formatNumber(claimableData.claimableVesting)} SOLF</div>
                    )}
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Claim Button */}
          <div className="flex justify-center">
            <Button
              onClick={handleClaim}
              disabled={!hasClaimableTokens || claimMutation.isPending}
              size="lg"
              className="w-full md:w-auto"
            >
              {claimMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Claiming...
                </>
              ) : hasClaimableTokens ? (
                <>
                  <Coins className="mr-2 h-4 w-4" />
                  Claim {formatNumber(claimableData.totalClaimable)} SOLF
                </>
              ) : (
                'No Tokens to Claim'
              )}
            </Button>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">
              How Vesting Works
            </h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• TGE tokens are available immediately after event finalization</li>
              <li>• Vesting tokens unlock linearly over the vesting period</li>
              <li>• You can claim available tokens at any time</li>
              <li>• Gas fees apply for each claim transaction</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Claim History */}
      {vestingSchedule?.claims && vestingSchedule.claims.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5" />
              <span>Claim History</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {vestingSchedule.claims.map((claim) => (
                <div
                  key={claim.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium">
                        {formatNumber(claim.totalClaimed)} SOLF
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {claim.claimType.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {formatDate(claim.claimTime)}
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <button
                      onClick={() => window.open(`https://explorer.solana.com/tx/${claim.transactionSignature}`, '_blank')}
                      className="text-xs text-blue-500 hover:underline"
                    >
                      View Transaction
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
