import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Wallet, RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { useWallet } from '../../providers/WalletProvider';
import { NETWORK_CONFIG } from '../../config';
import { parseSolanaError, formatSolanaError, withRetry } from '../../utils/solana-errors';
import backend from '~backend/client';

export function WalletBalance() {
  const { publicKey, connected, connection } = useWallet();

  const { data: balance, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['walletBalance', publicKey?.toString()],
    queryFn: async () => {
      if (!publicKey) return null;
      
      // Try backend first, with fallback to direct connection
      try {
        const response = await backend.wallet.getBalance({
          walletAddress: publicKey.toString()
        });
        return response;
      } catch (backendError) {
        console.warn('Backend balance check failed, trying direct connection:', backendError);
        
        // Fallback to direct Solana connection with retry logic
        try {
          const balanceInLamports = await withRetry(async () => {
            return await connection.getBalance(publicKey, 'confirmed');
          }, 3, 1000);
          
          return {
            balance: (balanceInLamports / 1e9).toString(),
            lamports: balanceInLamports.toString(),
            lastUpdated: Date.now()
          };
        } catch (directError) {
          // If both methods fail, throw the original backend error
          throw backendError;
        }
      }
    },
    enabled: connected && !!publicKey,
    refetchInterval: 30000, // Refresh every 30 seconds
    retry: (failureCount, error) => {
      const solanaError = parseSolanaError(error);
      // Don't retry on certain error types
      if (solanaError.code === 'INVALID_ADDRESS') {
        return false;
      }
      return failureCount < 2; // Reduced retries since we have fallback logic
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  });

  const formatBalance = (balance: string) => {
    const num = parseFloat(balance);
    if (num === 0) return '0';
    if (num < 0.001) return '<0.001';
    return num.toFixed(4);
  };

  const hasLowBalance = balance && parseFloat(balance.balance) < NETWORK_CONFIG.minBalanceForCreation;

  const handleExplorerClick = () => {
    if (publicKey) {
      const explorerUrl = `${NETWORK_CONFIG.explorerUrl}/address/${publicKey.toString()}`;
      window.open(explorerUrl, '_blank');
    }
  };

  if (!connected || !publicKey) {
    return null;
  }

  return (
    <Card className={hasLowBalance ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950' : ''}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center space-x-2">
            <Wallet className="h-4 w-4" />
            <span>SOL Balance</span>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleExplorerClick}
              className="h-auto p-1"
              title="View on Solana Explorer"
            >
              <ExternalLink className="h-3 w-3" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-auto p-1"
            >
              <RefreshCw className={`h-3 w-3 ${isRefetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-4 w-32" />
          </div>
        ) : error ? (
          <div className="text-center py-2">
            <p className="text-sm text-destructive">Failed to load balance</p>
            <p className="text-xs text-muted-foreground mt-1">
              {(() => {
                const solanaError = parseSolanaError(error);
                const formattedError = formatSolanaError(solanaError);
                return formattedError.description;
              })()}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="mt-2"
            >
              Retry
            </Button>
          </div>
        ) : balance ? (
          <div className="space-y-2">
            <div className="text-2xl font-bold">
              {formatBalance(balance.balance)} SOL
            </div>
            <div className="text-xs text-muted-foreground">
              {parseInt(balance.lamports).toLocaleString()} lamports
            </div>
            <div className="text-xs text-muted-foreground">
              {NETWORK_CONFIG.displayName}
            </div>
            
            {hasLowBalance && (
              <div className="flex items-start space-x-2 mt-3 p-2 bg-orange-100 dark:bg-orange-900 rounded-lg">
                <AlertTriangle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-orange-700 dark:text-orange-300">
                  <p className="font-medium">Low SOL Balance</p>
                  <p>You need at least {NETWORK_CONFIG.minBalanceForCreation} SOL to create tokens. Consider adding more SOL to your wallet.</p>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
