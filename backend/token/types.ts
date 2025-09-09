export interface TokenInfo {
  id: number;
  mintAddress: string;
  name: string;
  symbol: string;
  decimals: number;
  supply: string;
  description?: string;
  logoUrl?: string;
  metadataUrl?: string;
  creatorWallet: string;
  totalMinted: string;
  isMintable: boolean;
  isFrozen: boolean;
  createdAt: Date;
}
