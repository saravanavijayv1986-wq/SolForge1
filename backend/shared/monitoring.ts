import { createLogger } from "./logger";

const logger = createLogger('monitoring');

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
  tags?: Record<string, string>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  latency?: number;
  error?: string;
  details?: any;
}

class MetricsCollector {
  private metrics: Map<string, Metric[]> = new Map();
  private counters: Map<string, number> = new Map();
  private timers: Map<string, number> = new Map();

  // Counter metrics
  increment(name: string, value: number = 1, tags?: Record<string, string>): void {
    const currentValue = this.counters.get(name) || 0;
    this.counters.set(name, currentValue + value);
    
    this.recordMetric({
      name,
      value: currentValue + value,
      timestamp: new Date(),
      tags,
    });
  }

  // Gauge metrics
  gauge(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name,
      value,
      timestamp: new Date(),
      tags,
    });
  }

  // Timer metrics
  timer(name: string, tags?: Record<string, string>): () => void {
    const startTime = Date.now();
    const timerId = `${name}_${startTime}`;
    this.timers.set(timerId, startTime);

    return () => {
      const endTime = Date.now();
      const duration = endTime - startTime;
      this.timers.delete(timerId);
      
      this.recordMetric({
        name: `${name}_duration`,
        value: duration,
        timestamp: new Date(),
        tags,
      });
    };
  }

  // Histogram metrics
  histogram(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric({
      name: `${name}_histogram`,
      value,
      timestamp: new Date(),
      tags,
    });
  }

  private recordMetric(metric: Metric): void {
    const existing = this.metrics.get(metric.name) || [];
    existing.push(metric);
    
    // Keep only last 1000 metrics per name to prevent memory leak
    if (existing.length > 1000) {
      existing.shift();
    }
    
    this.metrics.set(metric.name, existing);
    
    // Log metric for external monitoring systems
    logger.debug('Metric recorded', {
      metricName: metric.name,
      metricValue: metric.value,
      metricTags: metric.tags,
    });
  }

  // Get metrics
  getMetrics(name?: string): Metric[] {
    if (name) {
      return this.metrics.get(name) || [];
    }
    
    const allMetrics: Metric[] = [];
    for (const metrics of this.metrics.values()) {
      allMetrics.push(...metrics);
    }
    return allMetrics;
  }

  // Get counter value
  getCounter(name: string): number {
    return this.counters.get(name) || 0;
  }

  // Reset metrics
  reset(): void {
    this.metrics.clear();
    this.counters.clear();
    this.timers.clear();
  }

  // Get statistics
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [name, value] of this.counters.entries()) {
      stats[`counter_${name}`] = value;
    }
    
    for (const [name, metrics] of this.metrics.entries()) {
      if (metrics.length > 0) {
        const values = metrics.map(m => m.value);
        stats[`metric_${name}`] = {
          count: values.length,
          min: Math.min(...values),
          max: Math.max(...values),
          avg: values.reduce((a, b) => a + b, 0) / values.length,
          latest: values[values.length - 1],
        };
      }
    }
    
    return stats;
  }
}

class HealthMonitor {
  private checks: Map<string, HealthCheck> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.startPeriodicChecks();
  }

  // Register a health check
  registerCheck(name: string, checkFn: () => Promise<HealthCheck>): void {
    // Store the check function for periodic execution
    setInterval(async () => {
      try {
        const result = await checkFn();
        this.checks.set(name, result);
        
        if (result.status !== 'healthy') {
          logger.warn(`Health check failed: ${name}`, {
            healthCheck: name,
            status: result.status,
            error: result.error,
          });
        }
      } catch (error) {
        const failedCheck: HealthCheck = {
          name,
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        this.checks.set(name, failedCheck);
        
        logger.error(`Health check error: ${name}`, {
          healthCheck: name,
        }, error instanceof Error ? error : new Error(String(error)));
      }
    }, 30000); // Check every 30 seconds
  }

  // Get health status
  getHealth(): Record<string, HealthCheck> {
    const health: Record<string, HealthCheck> = {};
    for (const [name, check] of this.checks.entries()) {
      health[name] = check;
    }
    return health;
  }

  // Get overall health status
  getOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const checks = Array.from(this.checks.values());
    
    if (checks.length === 0) {
      return 'unhealthy';
    }
    
    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;
    
    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  private startPeriodicChecks(): void {
    // Cleanup interval if it exists
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
    }

    // Log health status periodically
    this.checkInterval = setInterval(() => {
      const overallHealth = this.getOverallHealth();
      const healthChecks = this.getHealth();
      
      logger.info('Health status', {
        overallHealth,
        healthChecks: Object.keys(healthChecks).length,
        type: 'health',
      });
    }, 60000); // Log every minute
  }

  // Stop monitoring
  stop(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

class PerformanceMonitor {
  private apiMetrics: Map<string, number[]> = new Map();
  private dbMetrics: Map<string, number[]> = new Map();

  // Track API performance
  trackApiCall(endpoint: string, method: string, duration: number, statusCode: number): void {
    const key = `${method}_${endpoint}`;
    const existing = this.apiMetrics.get(key) || [];
    existing.push(duration);
    
    // Keep only last 100 measurements
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.apiMetrics.set(key, existing);
    
    // Log slow requests
    if (duration > 5000) {
      logger.warn('Slow API request', {
        endpoint,
        method,
        duration: `${duration}ms`,
        statusCode,
        type: 'performance',
      });
    }
    
    metrics.histogram('api_request_duration', duration, {
      endpoint,
      method,
      status: statusCode.toString(),
    });
  }

  // Track database performance
  trackDbQuery(operation: string, table: string, duration: number): void {
    const key = `${operation}_${table}`;
    const existing = this.dbMetrics.get(key) || [];
    existing.push(duration);
    
    // Keep only last 100 measurements
    if (existing.length > 100) {
      existing.shift();
    }
    
    this.dbMetrics.set(key, existing);
    
    // Log slow queries
    if (duration > 3000) {
      logger.warn('Slow database query', {
        operation,
        table,
        duration: `${duration}ms`,
        type: 'performance',
      });
    }
    
    metrics.histogram('db_query_duration', duration, {
      operation,
      table,
    });
  }

  // Get performance stats
  getStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    // API stats
    for (const [key, durations] of this.apiMetrics.entries()) {
      if (durations.length > 0) {
        stats[`api_${key}`] = {
          count: durations.length,
          avg: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          p95: this.calculatePercentile(durations, 95),
        };
      }
    }
    
    // DB stats
    for (const [key, durations] of this.dbMetrics.entries()) {
      if (durations.length > 0) {
        stats[`db_${key}`] = {
          count: durations.length,
          avg: durations.reduce((a, b) => a + b, 0) / durations.length,
          min: Math.min(...durations),
          max: Math.max(...durations),
          p95: this.calculatePercentile(durations, 95),
        };
      }
    }
    
    return stats;
  }

  private calculatePercentile(values: number[], percentile: number): number {
    const sorted = values.slice().sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[index] || 0;
  }
}

// Global instances
export const metrics = new MetricsCollector();
export const health = new HealthMonitor();
export const performance = new PerformanceMonitor();

// Utility functions
export const trackApiPerformance = (endpoint: string, method: string) => {
  const timer = metrics.timer('api_request', { endpoint, method });
  const startTime = Date.now();
  
  return (statusCode: number) => {
    const duration = Date.now() - startTime;
    timer();
    performance.trackApiCall(endpoint, method, duration, statusCode);
    metrics.increment('api_requests_total', 1, { endpoint, method, status: statusCode.toString() });
  };
};

export const trackDbPerformance = (operation: string, table: string) => {
  const timer = metrics.timer('db_query', { operation, table });
  const startTime = Date.now();
  
  return () => {
    const duration = Date.now() - startTime;
    timer();
    performance.trackDbQuery(operation, table, duration);
    metrics.increment('db_queries_total', 1, { operation, table });
  };
};

// Health check utilities
export const createHealthCheck = (name: string, checkFn: () => Promise<Omit<HealthCheck, 'name'>>): void => {
  health.registerCheck(name, async () => {
    const result = await checkFn();
    return { ...result, name };
  });
};

// Metrics middleware for API endpoints
export const metricsMiddleware = () => {
  return (endpoint: string, method: string) => {
    const trackPerf = trackApiPerformance(endpoint, method);
    
    return {
      onSuccess: () => trackPerf(200),
      onError: (statusCode: number = 500) => trackPerf(statusCode),
    };
  };
};
