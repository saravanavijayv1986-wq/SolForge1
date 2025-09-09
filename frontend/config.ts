// Solana RPC endpoint for mainnet
export const SOLANA_RPC_ENDPOINT = "https://api.mainnet-beta.solana.com";

// Supported wallet adapters
export const SUPPORTED_WALLETS = ['phantom', 'solflare'] as const;

// Application branding
export const APP_CONFIG = {
  name: "SolForge",
  tagline: "Enterprise Token Creation Platform",
  description: "Create, manage, and deploy SPL tokens on Solana with enterprise-grade infrastructure",
  version: "1.0.0"
} as const;

// Token creation fee in SOL
export const TOKEN_CREATION_FEE = 0.1;

// Wallet information
export const WALLET_INFO = {
  phantom: {
    name: 'Phantom',
    description: 'A friendly Solana wallet built for DeFi & NFTs',
    downloadUrl: 'https://phantom.app/',
    website: 'https://phantom.app/',
  },
  solflare: {
    name: 'Solflare',
    description: 'A secure Solana wallet for web and mobile',
    downloadUrl: 'https://solflare.com/',
    website: 'https://solflare.com/',
  },
} as const;

// Network configuration
export const NETWORK_CONFIG = {
  name: 'Mainnet Beta',
  displayName: 'Solana Mainnet',
  isMainnet: true,
  explorerUrl: 'https://explorer.solana.com',
  minBalanceForCreation: 0.15, // 0.1 SOL fee + 0.05 SOL for tx fees
  confirmationTimeout: 60000, // 60 seconds
  maxRetries: 5
} as const;
