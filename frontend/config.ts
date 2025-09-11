// Solana configuration for Devnet
export const SOLANA_CONFIG = {
  network: 'devnet' as const,
  rpcEndpoint: "https://api.devnet.solana.com",
  backupEndpoints: [
    "https://devnet.genesysgo.net",
    "https://rpc.ankr.com/solana_devnet",
    "https://solana-devnet.g.alchemy.com/v2/demo",
  ],
  commitment: 'confirmed' as const,
  confirmationTimeout: 60000,
  maxRetries: 5
};

// Application branding
export const APP_CONFIG = {
  name: "SolForge",
  tagline: "Enterprise Token Creation Platform",
  description: "Create, manage, and deploy SPL tokens on Solana with enterprise-grade infrastructure",
  version: "1.0.0",
  environment: "development" // Will be overridden in production
} as const;

// Token creation configuration
export const TOKEN_CONFIG = {
  creationFee: 0.1, // SOL
  minBalanceForCreation: 0.15, // SOL
  maxSupply: 1000000000000, // 1 trillion max
  validation: {
    name: {
      minLength: 1,
      maxLength: 32,
      pattern: /^[a-zA-Z0-9\s\-_\.]+$/,
    },
    symbol: {
      minLength: 1,
      maxLength: 10,
      pattern: /^[A-Z0-9]+$/,
    },
    description: {
      maxLength: 500,
    },
  },
} as const;

// SOLF token configuration
export const SOLF_CONFIG = {
  totalSupply: 500000000, // 500M SOLF
  treasuryAllocation: 250000000, // 250M SOLF (50%)
  exchangeRate: 10000, // SOLF per SOL
  platformFee: 0.1, // SOL per transaction
  minPurchase: 0.2, // SOL
  maxPurchase: 1000, // SOL
} as const;

// Network configuration
export const NETWORK_CONFIG = {
  name: 'Devnet',
  displayName: 'Solana Devnet',
  isMainnet: false,
  explorerUrl: 'https://explorer.solana.com',
  explorerCluster: '?cluster=devnet',
  minBalanceForCreation: TOKEN_CONFIG.minBalanceForCreation,
  confirmationTimeout: SOLANA_CONFIG.confirmationTimeout,
  maxRetries: SOLANA_CONFIG.maxRetries
} as const;

// Wallet configuration
export const WALLET_CONFIG = {
  autoConnect: true,
  supportedWallets: ['phantom', 'solflare', 'backpack'] as const,
  walletInfo: {
    phantom: {
      name: 'Phantom',
      description: 'A friendly Solana wallet built for DeFi & NFTs',
      downloadUrl: 'https://phantom.app/',
    },
    solflare: {
      name: 'Solflare',
      description: 'A secure Solana wallet for web and mobile',
      downloadUrl: 'https://solflare.com/',
    },
    backpack: {
      name: 'Backpack',
      description: 'A modern crypto wallet',
      downloadUrl: 'https://backpack.app/',
    },
  },
} as const;

// UI configuration
export const UI_CONFIG = {
  toast: {
    duration: 4000,
    position: 'bottom-right' as const,
  },
  animation: {
    duration: 200,
    easing: 'ease-in-out' as const,
  },
  pagination: {
    defaultPageSize: 20,
    pageSizes: [10, 20, 50, 100],
  },
} as const;

// API configuration
export const API_CONFIG = {
  timeout: 30000,
  retries: 3,
  retryDelay: 1000,
  endpoints: {
    health: '/health',
    metrics: '/health/metrics',
  },
} as const;

// Feature flags
export const FEATURES = {
  analytics: false, // Coming in Q1 2025
  governance: false, // Coming in Q3 2025
  crossChain: false, // Coming in Q4 2025
  staking: false, // Coming in Q1 2025
  launchpad: true, // Available now
  dexIntegration: false, // Coming in Q1 2025
} as const;

// Development/debugging configuration
export const DEBUG_CONFIG = {
  enabled: process.env.NODE_ENV === 'development',
  logLevel: 'info' as const,
  showPerformanceMetrics: false,
  mockTransactions: true, // For devnet testing
} as const;

// Security configuration
export const SECURITY_CONFIG = {
  maxFileSize: 5 * 1024 * 1024, // 5MB for logo uploads
  allowedFileTypes: ['image/png', 'image/jpeg', 'image/gif', 'image/webp'],
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 100,
  },
} as const;

// Validation utilities
export const validateConfig = () => {
  // Validate required configuration
  if (!SOLANA_CONFIG.rpcEndpoint) {
    throw new Error('Solana RPC endpoint is required');
  }
  
  if (TOKEN_CONFIG.creationFee <= 0) {
    throw new Error('Token creation fee must be positive');
  }
  
  if (SOLF_CONFIG.exchangeRate <= 0) {
    throw new Error('SOLF exchange rate must be positive');
  }
  
  return true;
};

// Initialize configuration validation
validateConfig();

// Export utility functions
export const getExplorerUrl = (address: string, type: 'address' | 'tx' = 'address'): string => {
  return `${NETWORK_CONFIG.explorerUrl}/${type}/${address}${NETWORK_CONFIG.explorerCluster}`;
};

export const formatSolAmount = (lamports: number): string => {
  return (lamports / 1e9).toFixed(4);
};

export const parseSolAmount = (solAmount: string): number => {
  const amount = parseFloat(solAmount);
  if (isNaN(amount) || amount < 0) {
    throw new Error('Invalid SOL amount');
  }
  return Math.floor(amount * 1e9);
};

export const isValidSolanaAddress = (address: string): boolean => {
  try {
    // Basic validation - in a real app you'd use @solana/web3.js PublicKey
    return address.length >= 32 && address.length <= 44 && /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
  } catch {
    return false;
  }
};

// Environment-specific overrides
if (typeof window !== 'undefined') {
  // Browser environment
  const hostname = window.location.hostname;
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    // Development environment
    (UI_CONFIG as any).showDebugInfo = true;
    (DEBUG_CONFIG as any).enabled = true;
  }
}
