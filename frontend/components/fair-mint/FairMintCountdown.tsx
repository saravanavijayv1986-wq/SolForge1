import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, TrendingUp } from 'lucide-react';

interface FairMintCountdownProps {
  startTime?: Date;
  endTime?: Date;
  status: 'upcoming' | 'live' | 'ended' | 'finalized';
  timeRemaining?: number;
  totalUsdBurned: string;
  totalParticipants: number;
}

export function FairMintCountdown({ 
  startTime, 
  endTime, 
  status, 
  timeRemaining: initialTimeRemaining, 
  totalUsdBurned,
  totalParticipants 
}: FairMintCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState(initialTimeRemaining || 0);

  useEffect(() => {
    if (status === 'live' || status === 'upcoming') {
      const interval = setInterval(() => {
        setTimeRemaining(prev => Math.max(0, prev - 1));
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [status]);

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return "00:00:00:00";
    
    const days = Math.floor(seconds / (24 * 3600));
    const hours = Math.floor((seconds % (24 * 3600)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    return `${days.toString().padStart(2, '0')}:${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getStatusBadge = () => {
    switch (status) {
      case 'upcoming':
        return <Badge variant="outline" className="text-blue-600 border-blue-200">Upcoming</Badge>;
      case 'live':
        return <Badge className="bg-green-100 text-green-800 border-green-200 animate-pulse">🔴 LIVE</Badge>;
      case 'ended':
        return <Badge variant="outline" className="text-orange-600 border-orange-200">Ended</Badge>;
      case 'finalized':
        return <Badge className="bg-purple-100 text-purple-800 border-purple-200">Finalized</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getTimeLabel = () => {
    switch (status) {
      case 'upcoming':
        return 'Starts in';
      case 'live':
        return 'Ends in';
      case 'ended':
        return 'Event ended';
      case 'finalized':
        return 'Event completed';
      default:
        return 'Time remaining';
    }
  };

  return (
    <Card className={`${status === 'live' ? 'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950' : ''}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Clock className="h-5 w-5" />
            <span>Fair Mint Event</span>
          </div>
          {getStatusBadge()}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Countdown Timer */}
        <div className="text-center">
          <p className="text-sm text-muted-foreground mb-2">{getTimeLabel()}</p>
          <div className="text-4xl font-mono font-bold text-foreground">
            {formatTimeRemaining(timeRemaining)}
          </div>
          <div className="text-xs text-muted-foreground mt-1">
            DAYS : HOURS : MINUTES : SECONDS
          </div>
        </div>

        {/* Event Stats */}
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Total Burned</span>
            </div>
            <p className="text-lg font-bold">${Number(totalUsdBurned).toLocaleString()}</p>
          </div>
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Calendar className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Participants</span>
            </div>
            <p className="text-lg font-bold">{totalParticipants.toLocaleString()}</p>
          </div>
        </div>

        {/* Event Dates */}
        {startTime && endTime && (
          <div className="text-xs text-muted-foreground space-y-1">
            <div>Start: {new Date(startTime).toLocaleString()}</div>
            <div>End: {new Date(endTime).toLocaleString()}</div>
          </div>
        )}

        {/* Status Messages */}
        {status === 'upcoming' && (
          <div className="text-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              Get ready! The fair mint will begin soon.
            </p>
          </div>
        )}

        {status === 'live' && (
          <div className="text-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
            <p className="text-sm text-green-700 dark:text-green-300">
              🔥 Fair Mint is LIVE! Burn your SPL tokens now!
            </p>
          </div>
        )}

        {status === 'ended' && (
          <div className="text-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
            <p className="text-sm text-orange-700 dark:text-orange-300">
              Fair Mint has ended. Waiting for finalization...
            </p>
          </div>
        )}

        {status === 'finalized' && (
          <div className="text-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
            <p className="text-sm text-purple-700 dark:text-purple-300">
              Event completed! You can now claim your SOLF tokens.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
