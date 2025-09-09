import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Clock } from 'lucide-react';
import type { EventSummary } from '~backend/fairmint/api';

interface EventInfoProps {
  event: EventSummary;
}

export function EventInfo({ event }: EventInfoProps) {
  const now = new Date();
  const startTime = new Date(event.startTime);
  const endTime = new Date(event.endTime);
  const totalDuration = endTime.getTime() - startTime.getTime();
  const elapsedDuration = now.getTime() - startTime.getTime();
  const progress = Math.min(100, (elapsedDuration / totalDuration) * 100);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Clock className="h-5 w-5" />
          <span>Event Timeline</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="flex justify-between text-sm mb-1">
            <span>Starts: {startTime.toLocaleString()}</span>
            <span>Ends: {endTime.toLocaleString()}</span>
          </div>
          <div className="w-full bg-muted rounded-full h-2.5">
            <div className="bg-blue-600 h-2.5 rounded-full" style={{ width: `${progress}%` }}></div>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{event.description}</p>
      </CardContent>
    </Card>
  );
}
