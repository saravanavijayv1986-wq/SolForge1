import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  TrendingUp, 
  Users, 
  Activity, 
  Clock,
  RefreshCw,
  Zap,
  Target,
  Eye,
  BarChart3
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import backend from '~backend/client';

interface EnhancedSafetyDashboardProps {
  eventId?: number;
  isAdmin?: boolean;
}

export function EnhancedSafetyDashboard({ eventId, isAdmin = false }: EnhancedSafetyDashboardProps) {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState('overview');

  const { data: safetyReport, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ['enhancedSafetyCheck', eventId],
    queryFn: async () => {
      const response = await backend.fairmint.performEnhancedSafetyCheck({ eventId });
      return response;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: anomalies } = useQuery({
    queryKey: ['anomalyDetection', eventId],
    queryFn: async () => {
      if (!eventId) return { anomalies: [] };
      const response = await backend.fairmint.detectAnomalies({ eventId });
      return response;
    },
    enabled: !!eventId,
    refetchInterval: 60000, // Check for anomalies every minute
  });

  const handleRefresh = async () => {
    try {
      await refetch();
      toast({
        title: "Safety Data Updated",
        description: "Enhanced safety monitoring data has been refreshed.",
      });
    } catch (error) {
      toast({
        title: "Refresh Failed",
        description: "Failed to update safety monitoring data.",
        variant: "destructive",
      });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'safe': return 'text-green-600 dark:text-green-400';
      case 'warning': return 'text-yellow-600 dark:text-yellow-400';
      case 'unsafe': return 'text-orange-600 dark:text-orange-400';
      case 'critical': return 'text-red-600 dark:text-red-400';
      default: return 'text-muted-foreground';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'safe':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">All Safe</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">Warning</Badge>;
      case 'unsafe':
        return <Badge className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">Unsafe</Badge>;
      case 'critical':
        return <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">Critical</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const getSeverityIcon = (severity: string, passed: boolean) => {
    if (passed) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="h-4 w-4 text-red-500" />;
      case 'error':
        return <AlertTriangle className="h-4 w-4 text-orange-500" />;
      case 'warning':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <CheckCircle className="h-4 w-4 text-blue-500" />;
    }
  };

  const formatMetricValue = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(2)}M`;
    } else if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toLocaleString();
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Shield className="h-5 w-5" />
            <span>Enhanced Safety Dashboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
            <span className="ml-2">Loading enhanced safety data...</span>
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
            <span>Enhanced Safety Dashboard</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              Unable to load enhanced safety monitoring data. Please try refreshing.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const criticalChecks = safetyReport.checks.filter(check => 
    check.severity === 'critical' && !check.passed
  );
  const errorChecks = safetyReport.checks.filter(check => 
    check.severity === 'error' && !check.passed
  );
  const warningChecks = safetyReport.checks.filter(check => 
    check.severity === 'warning' && !check.passed
  );

  return (
    <div className="space-y-6">
      {/* Overall Status Header */}
      <Card className={
        safetyReport.overallStatus === 'critical' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' :
        safetyReport.overallStatus === 'unsafe' ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950' :
        safetyReport.overallStatus === 'warning' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950' :
        'border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950'
      }>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Shield className="h-5 w-5" />
              <span>Enhanced Safety Dashboard</span>
              {getStatusBadge(safetyReport.overallStatus)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isRefetching}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                {criticalChecks.length}
              </div>
              <div className="text-sm text-muted-foreground">Critical Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {errorChecks.length}
              </div>
              <div className="text-sm text-muted-foreground">Error Issues</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">
                {warningChecks.length}
              </div>
              <div className="text-sm text-muted-foreground">Warnings</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                {safetyReport.checks.filter(c => c.passed).length}
              </div>
              <div className="text-sm text-muted-foreground">Passed Checks</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Critical Alerts */}
      {safetyReport.alerts.length > 0 && (
        <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-red-800 dark:text-red-200">
              <Zap className="h-5 w-5" />
              <span>Active Alerts</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {safetyReport.alerts.map((alert, index) => (
                <Alert key={index} className={
                  alert.level === 'critical' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' :
                  'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950'
                }>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <span className="font-medium">{alert.message}</span>
                      <Badge variant={alert.level === 'critical' ? 'destructive' : 'secondary'}>
                        {alert.action}
                      </Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabbed Safety Details */}
      <Card>
        <CardContent className="pt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="metrics">Metrics</TabsTrigger>
              <TabsTrigger value="checks">Checks</TabsTrigger>
              <TabsTrigger value="anomalies">Anomalies</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6 mt-6">
              {/* Risk Factors */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center space-x-2">
                      <BarChart3 className="h-4 w-4" />
                      <span>Risk Factors</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Price Volatility</span>
                        <span>{safetyReport.metrics.priceVolatility.toFixed(1)}%</span>
                      </div>
                      <Progress value={Math.min(safetyReport.metrics.priceVolatility * 2, 100)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Burn Concentration</span>
                        <span>{((safetyReport.metrics.suspiciousActivity / Math.max(safetyReport.metrics.participantCount, 1)) * 100).toFixed(1)}%</span>
                      </div>
                      <Progress value={Math.min((safetyReport.metrics.suspiciousActivity / Math.max(safetyReport.metrics.participantCount, 1)) * 100, 100)} className="h-2" />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Velocity Risk</span>
                        <span>{parseFloat(safetyReport.metrics.burnVelocity) > 100000 ? 'High' : parseFloat(safetyReport.metrics.burnVelocity) > 50000 ? 'Medium' : 'Low'}</span>
                      </div>
                      <Progress value={Math.min(parseFloat(safetyReport.metrics.burnVelocity) / 1000, 100)} className="h-2" />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center space-x-2">
                      <Activity className="h-4 w-4" />
                      <span>Live Activity</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Burn Rate:</span>
                      <span className="font-medium">{`$${formatMetricValue(safetyReport.metrics.burnVelocity)}/hr`}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Active Users:</span>
                      <span className="font-medium">{formatMetricValue(safetyReport.metrics.participantCount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Total Burns:</span>
                      <span className="font-medium">{formatMetricValue(safetyReport.metrics.totalBurns)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Avg Burn:</span>
                      <span className="font-medium">{`$${formatMetricValue(safetyReport.metrics.avgBurnUsd)}`}</span>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="metrics" className="space-y-6 mt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center space-x-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span>Volume Metrics</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{`$${formatMetricValue(safetyReport.metrics.totalUsdBurned)}`}</div>
                      <div className="text-sm text-muted-foreground">Total Burned</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold">{`$${formatMetricValue(safetyReport.metrics.burnVelocity)}`}</div>
                      <div className="text-sm text-muted-foreground">Hourly Rate</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center space-x-2">
                      <Users className="h-4 w-4 text-blue-500" />
                      <span>Participation</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold">{formatMetricValue(safetyReport.metrics.participantCount)}</div>
                      <div className="text-sm text-muted-foreground">Participants</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold">{formatMetricValue(safetyReport.metrics.totalBurns)}</div>
                      <div className="text-sm text-muted-foreground">Total Burns</div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center space-x-2">
                      <Eye className="h-4 w-4 text-orange-500" />
                      <span>Monitoring</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{safetyReport.metrics.suspiciousActivity}</div>
                      <div className="text-sm text-muted-foreground">Flagged Activity</div>
                    </div>
                    <div className="text-center">
                      <div className="text-xl font-semibold">{safetyReport.metrics.priceVolatility.toFixed(1)}%</div>
                      <div className="text-sm text-muted-foreground">Price Volatility</div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="checks" className="space-y-4 mt-6">
              {safetyReport.checks.map((check, index) => (
                <Card key={index} className={
                  !check.passed && check.severity === 'critical' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' :
                  !check.passed && check.severity === 'error' ? 'border-orange-200 bg-orange-50 dark:border-orange-800 dark:bg-orange-950' :
                  !check.passed && check.severity === 'warning' ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950' :
                  'border-border'
                }>
                  <CardContent className="pt-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        {getSeverityIcon(check.severity, check.passed)}
                        <div>
                          <h4 className="font-medium text-sm capitalize">
                            {check.checkType.replace(/_/g, ' ')}
                          </h4>
                          <p className="text-sm text-muted-foreground mt-1">
                            {check.message}
                          </p>
                          {check.recommendation && (
                            <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                              Recommendation: {check.recommendation}
                            </p>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant={check.passed ? "default" : "destructive"}
                        className="text-xs"
                      >
                        {check.passed ? "PASS" : "FAIL"}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            <TabsContent value="anomalies" className="space-y-4 mt-6">
              {anomalies && anomalies.anomalies.length > 0 ? (
                anomalies.anomalies.map((anomaly, index) => (
                  <Alert key={index} className={
                    anomaly.severity === 'critical' ? 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950' :
                    'border-yellow-200 bg-yellow-50 dark:border-yellow-800 dark:bg-yellow-950'
                  }>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertDescription>
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="font-medium capitalize">{anomaly.type.replace(/_/g, ' ')}</span>
                          <p className="text-sm">{anomaly.description}</p>
                        </div>
                        <Badge variant={anomaly.severity === 'critical' ? 'destructive' : 'secondary'}>
                          {anomaly.severity.toUpperCase()}
                        </Badge>
                      </div>
                    </AlertDescription>
                  </Alert>
                ))
              ) : (
                <div className="text-center py-8">
                  <CheckCircle className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <p className="text-muted-foreground">No anomalies detected in the last hour.</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
