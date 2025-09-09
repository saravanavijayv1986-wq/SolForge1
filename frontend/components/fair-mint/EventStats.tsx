import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { BarChart3, DollarSign, Flame } from 'lucide-react';
import backend from '~backend/client';

interface EventStatsProps {
  eventId: number;
}

export function EventStats({ eventId }: EventStatsProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['fairMintStats', eventId],
    queryFn: () => backend.fairmint.eventStats({ eventId }),
    refetchInterval: 15000, // Refetch every 15 seconds
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Event Statistics</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-8 w-1/2" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5" />
          <span>Event Statistics</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <DollarSign className="h-4 w-4" />
            <span>Total USD Burned</span>
          </div>
          <span className="font-bold text-lg">${parseFloat(data?.totalUsd || '0').toLocaleString()}</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Flame className="h-4 w-4" />
            <span>Total Burns</span>
          </div>
          <span className="font-bold text-lg">{data?.burns.toLocaleString() || 0}</span>
        </div>
      </CardContent>
    </Card>
  );
}
