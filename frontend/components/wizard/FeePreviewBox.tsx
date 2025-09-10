import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { DollarSign, Info, Zap, Shield, Globe, Clock } from 'lucide-react';
import { TOKEN_CREATION_FEE, NETWORK_CONFIG } from '../../config';

export function FeePreviewBox() {
  const estimatedNetworkFees = 0.01; // Estimated network costs
  const totalEstimatedCost = TOKEN_CREATION_FEE + estimatedNetworkFees;

  const feeBreakdown = [
    {
      label: 'Platform Fee',
      amount: TOKEN_CREATION_FEE,
      description: 'Fixed fee for token creation',
      icon: DollarSign,
      color: 'text-green-600'
    },
    {
      label: 'Network Fees',
      amount: estimatedNetworkFees,
      description: 'Solana transaction costs',
      icon: Zap,
      color: 'text-blue-600'
    }
  ];

  const includedFeatures = [
    {
      icon: Shield,
      label: 'SPL Token Deployment',
      description: `Deploy to ${NETWORK_CONFIG.displayName}`
    },
    {
      icon: Globe,
      label: 'Local Metadata Storage',
      description: 'Secure local storage for metadata'
    },
    {
      icon: Clock,
      label: 'Instant Deployment',
      description: 'Token ready in seconds'
    },
    {
      icon: Info,
      label: '24/7 Support',
      description: 'Technical assistance included'
    }
  ];

  return (
    <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <span>Cost Breakdown</span>
        </CardTitle>
        <CardDescription>
          Transparent pricing for token deployment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Fee Breakdown */}
          <div className="space-y-3">
            {feeBreakdown.map((fee, index) => {
              const Icon = fee.icon;
              return (
                <div key={index} className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Icon className={`h-4 w-4 ${fee.color}`} />
                    <div>
                      <span className="text-sm font-medium">{fee.label}</span>
                      <p className="text-xs text-muted-foreground">{fee.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="font-medium">{fee.amount} SOL</span>
                    {index === 0 && <Badge variant="secondary" className="text-xs">Fixed</Badge>}
                    {index === 1 && <Badge variant="outline" className="text-xs">Est.</Badge>}
                  </div>
                </div>
              );
            })}
          </div>
          
          <Separator />
          
          {/* Total */}
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Estimated</span>
            <span className="text-lg font-bold text-green-600">
              {totalEstimatedCost.toFixed(3)} SOL
            </span>
          </div>
          
          <Separator />
          
          {/* What's Included */}
          <div>
            <h4 className="font-medium mb-3 flex items-center space-x-2">
              <Info className="h-4 w-4 text-blue-500" />
              <span>What's Included</span>
            </h4>
            <div className="space-y-2">
              {includedFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-start space-x-2">
                    <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">{feature.label}</p>
                      <p className="text-xs text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Additional Info */}
          <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-blue-500 mt-0.5" />
              <div className="text-xs text-blue-700 dark:text-blue-300">
                <p className="font-medium mb-1">Price Protection</p>
                <p>Fixed platform fee regardless of SOL price fluctuations. Network fees may vary based on congestion.</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
