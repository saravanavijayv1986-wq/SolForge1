import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { DollarSign, Info, Zap } from 'lucide-react';
import { TOKEN_CREATION_FEE, NETWORK_CONFIG } from '../../config';

export function FeePreviewBox() {
  const estimatedTotalCost = TOKEN_CREATION_FEE + 0.01; // Fee + estimated network costs

  return (
    <Card className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center space-x-2">
          <DollarSign className="h-5 w-5 text-green-600" />
          <span>Cost Estimate</span>
        </CardTitle>
        <CardDescription>
          Transparent pricing for token deployment
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Platform Fee</span>
            <div className="flex items-center space-x-2">
              <span className="font-medium">{TOKEN_CREATION_FEE} SOL</span>
              <Badge variant="secondary" className="text-xs">Fixed</Badge>
            </div>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Network Fees</span>
            <span className="font-medium">~0.01 SOL</span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-sm text-muted-foreground">Arweave Storage</span>
            <span className="font-medium text-green-600">Included</span>
          </div>
          
          <hr className="border-muted-foreground/20" />
          
          <div className="flex justify-between items-center">
            <span className="font-medium">Total Estimated</span>
            <span className="text-lg font-bold text-green-600">
              {estimatedTotalCost.toFixed(2)} SOL
            </span>
          </div>
          
          <div className="text-xs text-muted-foreground">
            <div className="flex items-center space-x-1 mb-2">
              <Info className="h-3 w-3" />
              <span>What's included:</span>
            </div>
            <ul className="space-y-1 ml-4">
              <li>• SPL token deployment on {NETWORK_CONFIG.displayName}</li>
              <li>• Permanent metadata storage on Arweave</li>
              <li>• Token management dashboard access</li>
              <li>• 24/7 technical support</li>
            </ul>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
