import { secret } from "encore.dev/config";

// Database configuration
export const DATABASE_CONFIG = {
  connectionTimeout: 30000,
  queryTimeout: 15000,
  maxRetries: 3,
  retryDelay: 1000,
} as const;

// Solana configuration
export const SOLANA_CONFIG = {
  network: "devnet" as const,
  rpcTimeout: 30000,
  confirmationTimeout: 60000,
  maxRetries: 5,
  retryDelay: 2000,
  commitment: "confirmed" as const,
} as const;

// Application configuration
export const APP_CONFIG = {
  name: "SolForge",
  version: "1.0.0",
  environment: process.env.NODE_ENV || "development",
  cors: {
    origin: ["http://localhost:3000", "https://*.lp.dev"],
    credentials: true,
  },
} as const;

// Token creation configuration
export const TOKEN_CONFIG = {
  creationFee: 0.1, // SOL
  minBalanceRequired: 0.15, // SOL
  maxSupply: 1000000000000, // Maximum allowed token supply
  maxNameLength: 32,
  maxSymbolLength: 10,
  maxDescriptionLength: 500,
  supportedDecimals: [0, 2, 6, 9],
} as const;

// Rate limiting configuration
export const RATE_LIMIT_CONFIG = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100, // per window
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
} as const;

// Secrets configuration
export const SECRETS = {
  solanaRpcUrl: secret("SolanaRpcUrl"),
  databaseUrl: secret("DatabaseUrl"),
  redisUrl: secret("RedisUrl"),
  monitoringApiKey: secret("MonitoringApiKey"),
} as const;

// Solana addresses configuration
export const SOLANA_ADDRESSES = {
  // Platform treasury wallet (to be configured via environment)
  treasuryWallet: secret("TreasuryWallet"),
  // Team wallet for fees (to be configured via environment)
  teamWallet: secret("TeamWallet"),
} as const;

// SOLF token configuration
export const SOLF_CONFIG = {
  totalSupply: 500000000, // 500M SOLF
  treasuryAllocation: 250000000, // 250M SOLF (50%)
  teamAllocation: 100000000, // 100M SOLF (20%)
  liquidityAllocation: 100000000, // 100M SOLF (20%)
  reserveAllocation: 50000000, // 50M SOLF (10%)
  exchangeRate: 10000, // SOLF per SOL
  platformFee: 0.1, // SOL per transaction
  minPurchase: 0.2, // SOL
  maxPurchase: 1000, // SOL
} as const;

// Validation rules
export const VALIDATION_RULES = {
  tokenName: {
    minLength: 1,
    maxLength: TOKEN_CONFIG.maxNameLength,
    pattern: /^[a-zA-Z0-9\s\-_\.]+$/,
  },
  tokenSymbol: {
    minLength: 1,
    maxLength: TOKEN_CONFIG.maxSymbolLength,
    pattern: /^[A-Z0-9]+$/,
  },
  walletAddress: {
    length: [32, 44], // Base58 wallet address length range
    pattern: /^[1-9A-HJ-NP-Za-km-z]+$/,
  },
  transactionSignature: {
    minLength: 80,
    maxLength: 90,
    pattern: /^[1-9A-HJ-NP-Za-km-z]+$/,
  },
} as const;

// Monitoring and logging configuration
export const MONITORING_CONFIG = {
  logLevel: process.env.LOG_LEVEL || "info",
  metricsEnabled: true,
  tracingEnabled: true,
  healthCheckInterval: 30000, // 30 seconds
  alertThresholds: {
    errorRate: 0.05, // 5%
    responseTime: 5000, // 5 seconds
    dbConnectionTimeout: 10000, // 10 seconds
  },
} as const;
