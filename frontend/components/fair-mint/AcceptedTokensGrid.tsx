import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Coins, TrendingDown } from 'lucide-react';

interface AcceptedToken {
  id: number;
  mintAddress: string;
  tokenName: string;
  tokenSymbol: string;
  tokenLogoUrl?: string;
  dailyCapUsd: string;
  currentDailyBurnedUsd: string;
}

interface AcceptedTokensGridProps {
  tokens: AcceptedToken[];
  isLive: boolean;
}

export function AcceptedTokensGrid({ tokens, isLive }: AcceptedTokensGridProps) {
  const calculateCapProgress = (current: string, cap: string) => {
    const currentNum = parseFloat(current);
    const capNum = parseFloat(cap);
    return capNum > 0 ? (currentNum / capNum) * 100 : 0;
  };

  const formatCurrency = (amount: string) => {
    const num = parseFloat(amount);
    if (num >= 1000000) {
      return `$${(num / 1000000).toFixed(1)}M`;
    } else if (num >= 1000) {
      return `$${(num / 1000).toFixed(1)}K`;
    }
    return `$${num.toLocaleString()}`;
  };

  if (tokens.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Coins className="h-5 w-5" />
            <span>Accepted SPL Tokens</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
              <Coins className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No Tokens Available</h3>
            <p className="text-muted-foreground">
              No SPL tokens are currently accepted for the fair mint.
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
          <Coins className="h-5 w-5" />
          <span>Accepted SPL Tokens</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {tokens.map((token) => {
            const capProgress = calculateCapProgress(token.currentDailyBurnedUsd, token.dailyCapUsd);
            const remaining = parseFloat(token.dailyCapUsd) - parseFloat(token.currentDailyBurnedUsd);
            const isNearCap = capProgress > 80;

            return (
              <div
                key={token.id}
                className={`p-4 border rounded-lg transition-colors ${
                  isLive && !isNearCap 
                    ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950 hover:bg-green-100 dark:hover:bg-green-900' 
                    : isNearCap 
                    ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950'
                    : 'border-border hover:bg-muted/50'
                }`}
              >
                <div className="flex items-center space-x-3 mb-3">
                  {/* Token Logo */}
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center overflow-hidden flex-shrink-0">
                    {token.tokenLogoUrl ? (
                      <img 
                        src={token.tokenLogoUrl} 
                        alt={token.tokenName} 
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.style.display = 'none';
                          const parent = target.parentElement;
                          if (parent) {
                            parent.innerHTML = `<span class="text-white font-bold text-sm">${token.tokenSymbol.charAt(0)}</span>`;
                          }
                        }}
                      />
                    ) : (
                      <span className="text-white font-bold text-sm">
                        {token.tokenSymbol.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{token.tokenName}</h4>
                      <Badge variant="secondary" className="text-xs">
                        {token.tokenSymbol}
                      </Badge>
                    </div>
                    {isNearCap && (
                      <div className="flex items-center space-x-1">
                        <TrendingDown className="h-3 w-3 text-orange-500" />
                        <span className="text-xs text-orange-600 dark:text-orange-400">
                          Near daily cap
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Daily Cap Progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Daily Progress</span>
                    <span>{capProgress.toFixed(1)}%</span>
                  </div>
                  <Progress 
                    value={capProgress} 
                    className={`h-2 ${
                      isNearCap ? 'bg-orange-100 dark:bg-orange-900' : 'bg-muted'
                    }`}
                  />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      Burned: {formatCurrency(token.currentDailyBurnedUsd)}
                    </span>
                    <span className={`font-medium ${isNearCap ? 'text-orange-600 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}`}>
                      Left: {formatCurrency(remaining.toString())}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Daily Cap: {formatCurrency(token.dailyCapUsd)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-6 p-3 bg-muted rounded-lg">
          <h4 className="font-medium text-sm mb-2">Token Status</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <span>Available for burning</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <span>Near daily cap (&gt;80%)</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span>Daily cap reached</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
