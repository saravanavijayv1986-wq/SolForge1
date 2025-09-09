import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, Activity, Shield, CheckCircle, AlertTriangle, Clock } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface RaydiumPricingIndicatorProps {
  tokenSymbol: string;
  currentPrice?: string;
  priceRoute?: string;
  confidence?: number;
  lastUpdate?: Date;
  priceVolatility?: number;
  isLive?: boolean;
}

export function RaydiumPricingIndicator({
  tokenSymbol,
  currentPrice,
  priceRoute = "TOKEN/USDC",
  confidence = 95,
  lastUpdate,
  priceVolatility = 0,
  isLive = true
}: RaydiumPricingIndicatorProps) {
  
  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return "text-green-600 dark:text-green-400";
    if (confidence >= 75) return "text-yellow-600 dark:text-yellow-400";
    return "text-red-600 dark:text-red-400";
  };

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 90) {
      return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">High Confidence</Badge>;
    } else if (confidence >= 75) {
      return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Medium</Badge>;
    } else {
      return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Low</Badge>;
    }
  };

  const getVolatilityIndicator = (volatility: number) => {
    if (volatility <= 5) return { level: "Low", color: "text-green-600" };
    if (volatility <= 15) return { level: "Medium", color: "text-yellow-600" };
    return { level: "High", color: "text-red-600" };
  };

  const volatilityInfo = getVolatilityIndicator(priceVolatility);

  return (
    <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-2">
            <TrendingUp className="h-4 w-4 text-blue-500" />
            <span>Raydium Pricing - {tokenSymbol}</span>
          </div>
          {isLive && (
            <div className="flex items-center space-x-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-xs text-green-600 dark:text-green-400">LIVE</span>
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Price */}
        {currentPrice && (
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-800 dark:text-blue-200">
              ${parseFloat(currentPrice).toFixed(6)}
            </div>
            <div className="text-xs text-blue-600 dark:text-blue-400">
              Current Price (USD)
            </div>
          </div>
        )}

        {/* Price Route and Confidence */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-blue-700 dark:text-blue-300">Route:</span>
            <Badge variant="outline" className="text-blue-600 border-blue-300">
              {priceRoute}
            </Badge>
          </div>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-blue-700 dark:text-blue-300">Confidence:</span>
              {getConfidenceBadge(confidence)}
            </div>
            <Progress value={confidence} className="h-2" />
            <div className="text-xs text-center text-blue-600 dark:text-blue-400">
              {confidence}% confidence level
            </div>
          </div>
        </div>

        {/* Volatility Indicator */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <Activity className="h-3 w-3" />
              <span className="text-sm text-blue-700 dark:text-blue-300">Volatility:</span>
            </div>
            <span className={`text-sm font-medium ${volatilityInfo.color}`}>
              {volatilityInfo.level} ({priceVolatility.toFixed(1)}%)
            </span>
          </div>
          <Progress 
            value={Math.min(priceVolatility * 2, 100)} 
            className={`h-1 ${priceVolatility > 15 ? 'bg-red-100' : priceVolatility > 5 ? 'bg-yellow-100' : 'bg-green-100'}`}
          />
        </div>

        {/* Last Update */}
        {lastUpdate && (
          <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-400">
            <div className="flex items-center space-x-1">
              <Clock className="h-3 w-3" />
              <span>Updated:</span>
            </div>
            <span>{new Date(lastUpdate).toLocaleTimeString()}</span>
          </div>
        )}

        {/* Raydium Quality Indicators */}
        <div className="border-t border-blue-200 dark:border-blue-700 pt-3">
          <div className="text-xs text-blue-700 dark:text-blue-300 mb-2 font-medium">
            Raydium Quality Indicators:
          </div>
          <div className="space-y-1 text-xs">
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-blue-600 dark:text-blue-400">DEX-native pricing</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle className="h-3 w-3 text-green-500" />
              <span className="text-blue-600 dark:text-blue-400">Real-time liquidity</span>
            </div>
            <div className="flex items-center space-x-2">
              <Shield className="h-3 w-3 text-blue-500" />
              <span className="text-blue-600 dark:text-blue-400">Manipulation resistant</span>
            </div>
          </div>
        </div>

        {/* Warnings for low confidence or high volatility */}
        {(confidence < 80 || priceVolatility > 20) && (
          <Alert className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <AlertDescription className="text-amber-700 dark:text-amber-300 text-xs">
              {confidence < 80 && "Low confidence pricing detected. "}
              {priceVolatility > 20 && "High price volatility observed. "}
              Consider waiting for better market conditions.
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
