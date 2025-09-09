import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Flame, Info } from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { EventInfo } from '../components/fair-mint/EventInfo';
import { BurnForm } from '../components/fair-mint/BurnForm';
import { EventStats } from '../components/fair-mint/EventStats';
import backend from '~backend/client';

export function FairMintPage() {
  const { connected } = useWallet();

  const { data: eventsData, isLoading } = useQuery({
    queryKey: ['fairMintActiveEvents'],
    queryFn: () => backend.fairmint.listEvents(),
  });

  const activeEvent = eventsData?.events?.[0];

  if (isLoading) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-96 mb-2" />
          <Skeleton className="h-6 w-[500px] mb-8" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <Skeleton className="h-96" />
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground mb-2">Proof-of-Burn Fair Mint</h1>
            <p className="text-muted-foreground mb-8">
              A fair distribution mechanism for new tokens.
            </p>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-center space-x-2">
                  <Info className="h-5 w-5 text-blue-500" />
                  <span>No Active Fair Mint Event</span>
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
                    There is no active fair mint event at the moment. Stay tuned for announcements!
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">{activeEvent.eventName}</h1>
          <p className="text-muted-foreground">{activeEvent.description}</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-8">
            <EventInfo event={activeEvent} />
            <EventStats eventId={activeEvent.id} />
          </div>
          <div>
            {connected ? (
              <BurnForm eventId={activeEvent.id} />
            ) : (
              <WalletConnectPrompt />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
