import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, AlertTriangle, CheckCircle, RefreshCw, Clock, TrendingUp, Users } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

interface SafetyMonitorProps {
  eventId?: number;
  isAdmin?: boolean;
}

export function SafetyMonitor({ eventId, isAdmin = false }: SafetyMonitorProps) {
  const { toast } = useToast();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data: safetyReport, isLoading, refetch } = useQuery({
    queryKey: ['safetyCheck', eventId],
    queryFn: async () => {
      const response = await backend.fairmint.performSafetyCheck({ eventId });
      return response;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
      toast({
        title: "Safety Check Updated",
        description: "Safety monitoring data has been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to update safety monitoring data.",
        variant: "destructive",
      });
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe':
        return 'text-green-600 dark:text-green-400';
      case 'warning':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'unsafe':
        return 'text-red-600 dark:text-red-400';
      default:
        return 'text-muted-foreground';
    }
  };

  const getStatusIcon = (severity: string, passed: boolean) => {
    if (passed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    switch (severity) {
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'safe':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Safe</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Warning</Badge>;
      case 'unsafe':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Unsafe</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Safety Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <Skeleton className="h-8 w-32" />
            <Skeleton className="h-20 w-full" />
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!safetyReport) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Safety Monitor</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load safety monitoring data. Please try refreshing.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const criticalChecks = safetyReport.checks.filter(check => 
    check.severity === 'error' && !check.passed
  );
  const warningChecks = safetyReport.checks.filter(check => 
    check.severity === 'warning' && !check.passed
  );

  return (
    <Card className={
      safetyReport.overallStatus === 'unsafe' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' :
      safetyReport.overallStatus === 'warning' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950' :
      'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
    }>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Safety Monitor</span>
            {getStatusBadge(safetyReport.overallStatus)}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Overall Status Summary */}
        <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg">
          <div>
            <h4 className={`font-semibold ${getStatusColor(safetyReport.overallStatus)}`}>
              System Status: {safetyReport.overallStatus.toUpperCase()}
            </h4>
            <p className="text-sm text-muted-foreground">
              Last checked: {new Date(safetyReport.timestamp).toLocaleString()}
            </p>
          </div>
          <div className="text-right">
            {criticalChecks.length > 0 && (
              <div className="text-red-600 dark:text-red-400 font-medium">
                {criticalChecks.length} Critical Issue{criticalChecks.length !== 1 ? 's' : ''}
              </div>
            )}
            {warningChecks.length > 0 && (
              <div className="text-yellow-600 dark:text-yellow-400 font-medium">
                {warningChecks.length} Warning{warningChecks.length !== 1 ? 's' : ''}
              </div>
            )}
            {criticalChecks.length === 0 && warningChecks.length === 0 && (
              <div className="text-green-600 dark:text-green-400 font-medium">
                All Systems Normal
              </div>
            )}
          </div>
        </div>

        {/* Critical Issues */}
        {criticalChecks.length > 0 && (
          <Alert className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-red-800 dark:text-red-200">Critical Issues Detected</p>
                {criticalChecks.map((check, index) => (
                  <div key={index} className="text-sm text-red-700 dark:text-red-300">
                    • {check.message}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Warning Issues */}
        {warningChecks.length > 0 && (
          <Alert className="border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-yellow-800 dark:text-yellow-200">Warnings</p>
                {warningChecks.map((check, index) => (
                  <div key={index} className="text-sm text-yellow-700 dark:text-yellow-300">
                    • {check.message}
                  </div>
                ))}
              </div>
            </AlertDescription>
          </Alert>
        )}

        {/* Detailed Checks */}
        <div className="space-y-3">
          <h4 className="font-medium">Safety Checks</h4>
          <div className="space-y-2">
            {safetyReport.checks.map((check, index) => (
              <div
                key={index}
                className={`flex items-center justify-between p-3 border rounded-lg ${
                  !check.passed && check.severity === 'error' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' :
                  !check.passed && check.severity === 'warning' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950' :
                  'border-border'
                }`}
              >
                <div className="flex items-center space-x-3">
                  {getStatusIcon(check.severity, check.passed)}
                  <div>
                    <span className="font-medium text-sm capitalize">
                      {check.checkType.replace(/_/g, ' ')}
                    </span>
                    <p className="text-xs text-muted-foreground">
                      {check.message}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={check.passed ? "default" : "destructive"}
                  className="text-xs"
                >
                  {check.passed ? "PASS" : "FAIL"}
                </Badge>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm font-medium">Passed</span>
            </div>
            <p className="text-lg font-bold">
              {safetyReport.checks.filter(c => c.passed).length}
            </p>
          </div>
          
          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">Warnings</span>
            </div>
            <p className="text-lg font-bold">
              {warningChecks.length}
            </p>
          </div>

          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span className="text-sm font-medium">Critical</span>
            </div>
            <p className="text-lg font-bold">
              {criticalChecks.length}
            </p>
          </div>

          <div className="text-center p-3 bg-muted rounded-lg">
            <div className="flex items-center justify-center space-x-1 mb-1">
              <Clock className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-medium">Total</span>
            </div>
            <p className="text-lg font-bold">
              {safetyReport.checks.length}
            </p>
          </div>
        </div>

        {/* Admin Actions */}
        {isAdmin && (safetyReport.overallStatus === 'unsafe' || criticalChecks.length > 0) && (
          <Alert className="border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950">
            <Shield className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium text-orange-800 dark:text-orange-200">
                  Admin Action May Be Required
                </p>
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Critical issues have been detected. Consider using emergency controls if necessary.
                </p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
