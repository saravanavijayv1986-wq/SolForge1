import { api } from "encore.dev/api";
import { tokenDB } from "../token/db";
import { secret } from "encore.dev/config";

const solanaRpcUrl = secret("SolanaRpcUrl");

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
}

export interface DetailedHealthCheck {
  database: {
    token: boolean;
    latency: number;
  };
  solana: {
    rpcHealthy: boolean;
    latency: number;
    blockHeight?: number;
  };
}

// Basic health check endpoint
export const healthCheck = api<void, HealthStatus>(
  { expose: true, method: "GET", path: "/health" },
  async () => {
    const services: HealthStatus['services'] = {};
    const startTime = Date.now();

    // Check database connectivity
    try {
      const dbStart = Date.now();
      await tokenDB.queryRow`SELECT 1 as test`;
      services.database = {
        status: 'healthy',
        latency: Date.now() - dbStart
      };
    } catch (error) {
      services.database = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Database connection failed'
      };
    }

    // Check Solana RPC
    try {
      const solanaStart = Date.now();
      const response = await fetch(solanaRpcUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBlockHeight'
        }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        services.solana = {
          status: 'healthy',
          latency: Date.now() - solanaStart,
          details: { blockHeight: data.result }
        };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      services.solana = {
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Solana RPC connection failed'
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

    return {
      status: overallStatus,
      services,
      timestamp: new Date(),
      version: '1.0.0'
    };
  }
);

// Detailed health check with comprehensive monitoring
export const detailedHealthCheck = api<void, DetailedHealthCheck>(
  { expose: true, method: "GET", path: "/health/detailed" },
  async () => {
    const results: Partial<DetailedHealthCheck> = {};

    // Database health
    try {
      const dbStart = Date.now();
      
      const tokenTest = await tokenDB.queryRow`SELECT 1 as test`;
      
      results.database = {
        token: !!tokenTest,
        latency: Date.now() - dbStart
      };
    } catch (error) {
      results.database = {
        token: false,
        latency: -1
      };
    }

    // Solana RPC health
    try {
      const solanaStart = Date.now();
      const response = await fetch(solanaRpcUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBlockHeight'
        }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        results.solana = {
          rpcHealthy: true,
          latency: Date.now() - solanaStart,
          blockHeight: data.result
        };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      results.solana = {
        rpcHealthy: false,
        latency: -1
      };
    }

    return results as DetailedHealthCheck;
  }
);

// Service-specific health checks
export const databaseHealth = api<void, { healthy: boolean; latency: number; details: any }>(
  { expose: true, method: "GET", path: "/health/database" },
  async () => {
    const start = Date.now();
    
    try {
      const tokenResult = await tokenDB.queryRow`SELECT COUNT(*)::INTEGER as tokens FROM tokens`;

      return {
        healthy: true,
        latency: Date.now() - start,
        details: {
          totalTokens: tokenResult?.tokens || 0
        }
      };
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
);

export const solanaHealth = api<void, { healthy: boolean; latency: number; details: any }>(
  { expose: true, method: "GET", path: "/health/solana" },
  async () => {
    const start = Date.now();
    
    try {
      const response = await fetch(solanaRpcUrl(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'getBlockHeight'
        }),
        signal: AbortSignal.timeout(5000)
      });
      
      if (response.ok) {
        const data = await response.json();
        return {
          healthy: true,
          latency: Date.now() - start,
          details: {
            blockHeight: data.result,
            rpcEndpoint: 'configured'
          }
        };
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      return {
        healthy: false,
        latency: Date.now() - start,
        details: { error: error instanceof Error ? error.message : 'Unknown error' }
      };
    }
  }
);
