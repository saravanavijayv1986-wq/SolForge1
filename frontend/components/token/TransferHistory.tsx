import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { History, ArrowUpRight, ArrowDownLeft, Copy, ExternalLink } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { useWallet } from '../../providers/WalletProvider';
import backend from '~backend/client';
import type { TransferRecord } from '~backend/token/transfer';

interface TransferHistoryProps {
  mintAddress?: string;
}

export function TransferHistory({ mintAddress }: TransferHistoryProps) {
  const [open, setOpen] = useState(false);
  const { publicKey } = useWallet();
  const { toast } = useToast();

  const { data, isLoading, error } = useQuery({
    queryKey: ['transferHistory', publicKey?.toString(), mintAddress],
    queryFn: async () => {
      if (!publicKey) return null;
      const response = await backend.token.getTransferHistory({
        walletAddress: publicKey.toString(),
        mintAddress,
        limit: 50,
      });
      return response;
    },
    enabled: open && !!publicKey,
  });

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: `${label} copied to clipboard.`,
    });
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
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

  const formatAmount = (amount: string, decimals: number) => {
    const num = parseFloat(amount);
    if (num >= 1e9) {
      return `${(num / 1e9).toFixed(2)}B`;
    } else if (num >= 1e6) {
      return `${(num / 1e6).toFixed(2)}M`;
    } else if (num >= 1e3) {
      return `${(num / 1e3).toFixed(2)}K`;
    }
    return num.toLocaleString(undefined, {
      minimumFractionDigits: 0,
      maximumFractionDigits: Math.min(6, decimals),
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="flex items-center space-x-1">
          <History className="h-3 w-3" />
          <span>History</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Transfer History</DialogTitle>
          <DialogDescription>
            {mintAddress ? 'Token transfer history' : 'All token transfer history'}
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <Skeleton className="w-6 h-6 rounded-full" />
                  <div className="flex-1 space-y-1">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-48" />
                  </div>
                  <Skeleton className="h-4 w-16" />
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">Failed to load transfer history</p>
            </div>
          ) : !data?.transfers || data.transfers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">No transfers yet</h3>
              <p className="text-muted-foreground">
                {mintAddress ? 'No transfers found for this token' : 'No token transfers found'}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {data.transfers.map((transfer) => (
                <div key={transfer.id} className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors">
                  {/* Direction Icon */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    transfer.direction === 'sent' 
                      ? 'bg-red-100 dark:bg-red-900' 
                      : 'bg-green-100 dark:bg-green-900'
                  }`}>
                    {transfer.direction === 'sent' ? (
                      <ArrowUpRight className={`h-4 w-4 ${
                        transfer.direction === 'sent' 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`} />
                    ) : (
                      <ArrowDownLeft className={`h-4 w-4 ${
                        transfer.direction === 'sent' 
                          ? 'text-red-600 dark:text-red-400' 
                          : 'text-green-600 dark:text-green-400'
                      }`} />
                    )}
                  </div>

                  {/* Transfer Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium">
                        {transfer.direction === 'sent' ? 'Sent' : 'Received'}
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {transfer.tokenInfo.symbol}
                      </Badge>
                    </div>
                    
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center space-x-1">
                        <span>
                          {transfer.direction === 'sent' ? 'To:' : 'From:'}
                        </span>
                        <button
                          onClick={() => copyToClipboard(
                            transfer.direction === 'sent' ? transfer.toAddress : transfer.fromAddress,
                            'Address'
                          )}
                          className="hover:text-foreground transition-colors"
                        >
                          {formatAddress(transfer.direction === 'sent' ? transfer.toAddress : transfer.fromAddress)}
                        </button>
                        <Copy className="h-3 w-3 opacity-50" />
                      </div>
                      <div className="text-xs">
                        {formatDate(transfer.createdAt)}
                      </div>
                    </div>
                  </div>

                  {/* Amount and Actions */}
                  <div className="text-right space-y-2">
                    <div className={`font-medium ${
                      transfer.direction === 'sent' ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'
                    }`}>
                      {transfer.direction === 'sent' ? '-' : '+'}
                      {formatAmount(transfer.amount, transfer.tokenInfo.decimals)} {transfer.tokenInfo.symbol}
                    </div>
                    <div className="flex items-center space-x-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(transfer.transactionSignature, 'Transaction signature')}
                        className="h-auto p-1"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(`https://explorer.solana.com/tx/${transfer.transactionSignature}`, '_blank')}
                        className="h-auto p-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </div>
              ))}

              {data.hasMore && (
                <div className="text-center pt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {data.transfers.length} of {data.total} transfers
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
