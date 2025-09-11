import { api } from "encore.dev/api";
import { tokenDB } from "../token/db";
import { launchpadDB } from "../launchpad/db";
import { solanaService } from "../shared/solana";
import { createLogger } from "../shared/logger";
import { metrics, health } from "../shared/monitoring";
import { MONITORING_CONFIG } from "../config/app";

const logger = createLogger('health');

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  services: {
    [serviceName: string]: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      latency?: number;
      error?: string;
      details?: any;
    };
  };
  timestamp: Date;
  version: string;
  uptime: number;
  environment: string;
}

export interface DetailedHealthCheck {
  database: {
    token: boolean;
    launchpad: boolean;
    latency: number;
    connectionPool?: {
      active: number;
      idle: number;
      total: number;
    };
  };
  solana: {
    rpcHealthy: boolean;
    latency: number;
    blockHeight?: number;
    network: string;
    endpoint: string;
  };
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  metrics: {
    totalRequests: number;
    errorRate: number;
    averageResponseTime: number;
  };
}

// Application start time for uptime calculation
const appStartTime = Date.now();

// Register health checks
health.registerCheck('database', async () => {
  const startTime = Date.now();
  
  try {
    // Test both databases
    await Promise.all([
      tokenDB.queryRow`SELECT 1 as test`,
      launchpadDB.queryRow`SELECT 1 as test`,
    ]);
    
    const latency = Date.now() - startTime;
    
    return {
      name: 'database',
      status: 'healthy' as const,
      latency,
      details: {
        tokenDB: 'connected',
        launchpadDB: 'connected',
      },
    };
  } catch (error) {
    const latency = Date.now() - startTime;
    return {
      name: 'database',
      status: 'unhealthy' as const,
      latency,
      error: error instanceof Error ? error.message : 'Database connection failed',
    };
  }
});

health.registerCheck('solana', async () => {
  try {
    const healthCheck = await solanaService.checkHealth();
    
    return {
      name: 'solana',
      status: healthCheck.healthy ? 'healthy' as const : 'unhealthy' as const,
      latency: healthCheck.latency,
      error: healthCheck.error,
      details: {
        slot: healthCheck.slot,
        network: 'devnet',
        endpoint: solanaService.getConnection().rpcEndpoint,
      },
    };
  } catch (error) {
    return {
      name: 'solana',
      status: 'unhealthy' as const,
      error: error instanceof Error ? error.message : 'Solana connection failed',
    };
  }
});

// Basic health check endpoint
export const healthCheck = api<void, HealthStatus>(
  { expose: true, method: "GET", path: "/health" },
  async () => {
    const timer = metrics.timer('health_check');
    
    try {
      const services: HealthStatus['services'] = {};
      const healthChecks = health.getHealth();
      
      // Convert health checks to services format
      for (const [name, check] of Object.entries(healthChecks)) {
        services[name] = {
          status: check.status,
          latency: check.latency,
          error: check.error,
          details: check.details,
        };
      }
      
      // Determine overall status
      const serviceStatuses = Object.values(services).map(s => s.status);
      let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
      
      if (serviceStatuses.includes('unhealthy')) {
        overallStatus = 'unhealthy';
      } else if (serviceStatuses.includes('degraded')) {
        overallStatus = 'degraded';
      } else {
        overallStatus = 'healthy';
      }
      
      const uptime = Date.now() - appStartTime;
      
      timer();
      metrics.increment('health_check_total');
      
      logger.info('Health check completed', {
        overallStatus,
        servicesCount: Object.keys(services).length,
        uptime: `${Math.floor(uptime / 1000)}s`,
      });
      
      return {
        status: overallStatus,
        services,
        timestamp: new Date(),
        version: '1.0.0',
        uptime: Math.floor(uptime / 1000), // in seconds
        environment: process.env.NODE_ENV || 'development',
      };
    } catch (error) {
      timer();
      metrics.increment('health_check_error');
      
      logger.error('Health check failed', {}, error instanceof Error ? error : new Error(String(error)));
      
      throw new Error('Health check failed');
    }
  }
);

// Detailed health check with comprehensive monitoring
export const detailedHealthCheck = api<void, DetailedHealthCheck>(
  { expose: true, method: "GET", path: "/health/detailed" },
  async () => {
    const timer = metrics.timer('detailed_health_check');
    
    try {
      const results: Partial<DetailedHealthCheck> = {};
      
      // Database health
      try {
        const dbStart = Date.now();
        const [tokenTest, launchpadTest] = await Promise.all([
          tokenDB.queryRow`SELECT 1 as test`,
          launchpadDB.queryRow`SELECT 1 as test`,
        ]);
        
        const dbLatency = Date.now() - dbStart;
        
        results.database = {
          token: !!tokenTest,
          launchpad: !!launchpadTest,
          latency: dbLatency,
        };
      } catch (error) {
        logger.error('Database detailed health check failed', {}, error instanceof Error ? error : new Error(String(error)));
        results.database = {
          token: false,
          launchpad: false,
          latency: -1,
        };
      }
      
      // Solana health
      try {
        const solanaHealth = await solanaService.checkHealth();
        
        results.solana = {
          rpcHealthy: solanaHealth.healthy,
          latency: solanaHealth.latency,
          blockHeight: solanaHealth.slot,
          network: 'devnet',
          endpoint: solanaService.getConnection().rpcEndpoint,
        };
      } catch (error) {
        logger.error('Solana detailed health check failed', {}, error instanceof Error ? error : new Error(String(error)));
        results.solana = {
          rpcHealthy: false,
          latency: -1,
          network: 'devnet',
          endpoint: 'unknown',
        };
      }
      
      // Memory usage
      const memoryUsage = process.memoryUsage();
      results.memory = {
        used: memoryUsage.heapUsed,
        free: memoryUsage.heapTotal - memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      };
      
      // Metrics
      const metricsStats = metrics.getStats();
      results.metrics = {
        totalRequests: metrics.getCounter('api_requests_total') || 0,
        errorRate: calculateErrorRate(),
        averageResponseTime: calculateAverageResponseTime(metricsStats),
      };
      
      timer();
      
      logger.debug('Detailed health check completed', {
        databaseHealthy: results.database?.token && results.database?.launchpad,
        solanaHealthy: results.solana?.rpcHealthy,
        memoryUsagePercent: results.memory?.percentage.toFixed(2),
      });
      
      return results as DetailedHealthCheck;
    } catch (error) {
      timer();
      
      logger.error('Detailed health check failed', {}, error instanceof Error ? error : new Error(String(error)));
      
      throw new Error('Detailed health check failed');
    }
  }
);

// Service-specific health checks
export const databaseHealth = api<void, { healthy: boolean; latency: number; details: any }>(
  { expose: true, method: "GET", path: "/health/database" },
  async () => {
    const timer = metrics.timer('database_health_check');
    const start = Date.now();
    
    try {
      // Test both databases with sample queries
      const [tokenCount, launchpadCount] = await Promise.all([
        tokenDB.queryRow`SELECT COUNT(*)::INTEGER as count FROM tokens`,
        launchpadDB.queryRow`SELECT COUNT(*)::INTEGER as count FROM launchpad_purchases`,
      ]);
      
      const latency = Date.now() - start;
      timer();
      
      logger.debug('Database health check successful', {
        latency: `${latency}ms`,
        tokenCount: tokenCount?.count || 0,
        launchpadCount: launchpadCount?.count || 0,
      });
      
      return {
        healthy: true,
        latency,
        details: {
          tokenDB: {
            connected: true,
            totalTokens: tokenCount?.count || 0,
          },
          launchpadDB: {
            connected: true,
            totalPurchases: launchpadCount?.count || 0,
          },
          connectionPool: {
            // In a real application, you'd get these from the connection pool
            active: 5,
            idle: 15,
            total: 20,
          },
        },
      };
    } catch (error) {
      const latency = Date.now() - start;
      timer();
      
      logger.error('Database health check failed', {
        latency: `${latency}ms`,
      }, error instanceof Error ? error : new Error(String(error)));
      
      return {
        healthy: false,
        latency,
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          tokenDB: { connected: false },
          launchpadDB: { connected: false },
        },
      };
    }
  }
);

export const solanaHealth = api<void, { healthy: boolean; latency: number; details: any }>(
  { expose: true, method: "GET", path: "/health/solana" },
  async () => {
    const timer = metrics.timer('solana_health_check');
    
    try {
      const healthCheck = await solanaService.checkHealth();
      timer();
      
      logger.debug('Solana health check completed', {
        healthy: healthCheck.healthy,
        latency: `${healthCheck.latency}ms`,
        slot: healthCheck.slot,
      });
      
      return {
        healthy: healthCheck.healthy,
        latency: healthCheck.latency,
        details: {
          slot: healthCheck.slot,
          network: 'devnet',
          endpoint: solanaService.getConnection().rpcEndpoint,
          commitment: 'confirmed',
          error: healthCheck.error,
        },
      };
    } catch (error) {
      timer();
      
      logger.error('Solana health check failed', {}, error instanceof Error ? error : new Error(String(error)));
      
      return {
        healthy: false,
        latency: -1,
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          network: 'devnet',
          endpoint: 'unknown',
        },
      };
    }
  }
);

// Metrics endpoint
export const metricsEndpoint = api<void, any>(
  { expose: true, method: "GET", path: "/health/metrics" },
  async () => {
    const timer = metrics.timer('metrics_collection');
    
    try {
      const allMetrics = {
        application: metrics.getStats(),
        health: health.getHealth(),
        system: {
          uptime: Math.floor((Date.now() - appStartTime) / 1000),
          memory: process.memoryUsage(),
          version: '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          timestamp: new Date().toISOString(),
        },
        performance: {
          errorRate: calculateErrorRate(),
          requestsPerMinute: calculateRequestsPerMinute(),
          averageResponseTime: calculateAverageResponseTime(metrics.getStats()),
        },
      };
      
      timer();
      
      logger.debug('Metrics collected', {
        metricsCount: Object.keys(allMetrics.application).length,
        healthChecks: Object.keys(allMetrics.health).length,
      });
      
      return allMetrics;
    } catch (error) {
      timer();
      
      logger.error('Metrics collection failed', {}, error instanceof Error ? error : new Error(String(error)));
      
      throw new Error('Failed to collect metrics');
    }
  }
);

// Utility functions for metric calculations
function calculateErrorRate(): number {
  const totalRequests = metrics.getCounter('api_requests_total') || 0;
  const errorRequests = metrics.getCounter('api_requests_error') || 0;
  
  if (totalRequests === 0) return 0;
  return (errorRequests / totalRequests) * 100;
}

function calculateRequestsPerMinute(): number {
  // This would be more sophisticated in a real implementation
  // For now, return a basic calculation
  const totalRequests = metrics.getCounter('api_requests_total') || 0;
  const uptimeMinutes = Math.max(1, Math.floor((Date.now() - appStartTime) / 60000));
  
  return totalRequests / uptimeMinutes;
}

function calculateAverageResponseTime(metricsStats: Record<string, any>): number {
  const apiMetrics = Object.entries(metricsStats)
    .filter(([key]) => key.startsWith('metric_api_request_duration'))
    .map(([_, value]: [string, any]) => value?.avg || 0)
    .filter(avg => avg > 0);
  
  if (apiMetrics.length === 0) return 0;
  
  return apiMetrics.reduce((sum, avg) => sum + avg, 0) / apiMetrics.length;
}
