import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { Connection, PublicKey } from '@solana/web3.js';
import { SOLANA_RPC_ENDPOINT } from '../config';

export type WalletType = 'phantom' | 'solflare' | null;

interface WalletContextType {
  connected: boolean;
  connecting: boolean;
  publicKey: PublicKey | null;
  wallet: any;
  walletType: WalletType;
  connect: (walletType?: WalletType) => Promise<void>;
  disconnect: () => Promise<void>;
  signMessage: (message: Uint8Array) => Promise<Uint8Array>;
  signTransaction: (transaction: any) => Promise<any>;
  availableWallets: WalletType[];
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet(): WalletContextType {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}

interface WalletProviderProps {
  children: React.ReactNode;
}

export function WalletProvider({ children }: WalletProviderProps) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [publicKey, setPublicKey] = useState<PublicKey | null>(null);
  const [wallet, setWallet] = useState<any>(null);
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [connection] = useState(() => new Connection(SOLANA_RPC_ENDPOINT));

  // Check available wallets
  const getAvailableWallets = useCallback((): WalletType[] => {
    const available: WalletType[] = [];
    
    if (typeof window !== 'undefined') {
      // Check for Phantom
      if (window.solana && window.solana.isPhantom) {
        available.push('phantom');
      }
      
      // Check for Solflare
      if (window.solflare && window.solflare.isSolflare) {
        available.push('solflare');
      }
    }
    
    return available;
  }, []);

  const availableWallets = getAvailableWallets();

  // Get wallet adapter by type
  const getWalletAdapter = useCallback((type: WalletType) => {
    if (typeof window === 'undefined') return null;
    
    switch (type) {
      case 'phantom':
        return window.solana && window.solana.isPhantom ? window.solana : null;
      case 'solflare':
        return window.solflare && window.solflare.isSolflare ? window.solflare : null;
      default:
        return null;
    }
  }, []);

  // Connect to wallet
  const connect = useCallback(async (preferredWalletType?: WalletType) => {
    let targetWalletType = preferredWalletType;
    
    if (!targetWalletType) {
      if (availableWallets.includes('phantom')) {
        targetWalletType = 'phantom';
      } else if (availableWallets.includes('solflare')) {
        targetWalletType = 'solflare';
      } else {
        throw new Error('No supported Solana wallet found. Please install Phantom or Solflare wallet extension.');
      }
    }

    const walletAdapter = getWalletAdapter(targetWalletType);
    if (!walletAdapter) {
      const walletName = targetWalletType === 'phantom' ? 'Phantom' : 'Solflare';
      throw new Error(`${walletName} wallet not found. Please install the ${walletName} wallet extension.`);
    }

    setConnecting(true);
    try {
      const response = await walletAdapter.connect();
      
      // The public key can be on the response (Phantom) or on the adapter itself (Solflare)
      const publicKeyFromAdapter = walletAdapter.publicKey || (response && response.publicKey);

      if (publicKeyFromAdapter) {
        const pubKey = new PublicKey(publicKeyFromAdapter.toString());
        
        setWallet(walletAdapter);
        setWalletType(targetWalletType);
        setPublicKey(pubKey);
        setConnected(true);
        
        // Store connection state
        localStorage.setItem('walletConnected', 'true');
        localStorage.setItem('walletType', targetWalletType);
        localStorage.setItem('walletPublicKey', pubKey.toString());
      } else {
        throw new Error("Connection request cancelled or failed.");
      }
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setConnecting(false);
    }
  }, [availableWallets, getWalletAdapter]);

  // Disconnect from wallet
  const disconnect = useCallback(async () => {
    if (wallet) {
      try {
        await wallet.disconnect();
      } catch (error) {
        console.error('Failed to disconnect wallet:', error);
      }
    }
    
    setWallet(null);
    setWalletType(null);
    setPublicKey(null);
    setConnected(false);
    
    // Clear connection state
    localStorage.removeItem('walletConnected');
    localStorage.removeItem('walletType');
    localStorage.removeItem('walletPublicKey');
  }, [wallet]);

  // Sign message
  const signMessage = useCallback(async (message: Uint8Array): Promise<Uint8Array> => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }
    
    const response = await wallet.signMessage(message, 'utf8');
    return response.signature;
  }, [wallet]);

  // Sign transaction
  const signTransaction = useCallback(async (transaction: any): Promise<any> => {
    if (!wallet) {
      throw new Error('Wallet not connected');
    }
    
    return await wallet.signTransaction(transaction);
  }, [wallet]);

  // Auto-connect on mount if previously connected
  useEffect(() => {
    const autoConnect = async () => {
      const wasConnected = localStorage.getItem('walletConnected') === 'true';
      const storedWalletType = localStorage.getItem('walletType') as WalletType;
      const storedPublicKey = localStorage.getItem('walletPublicKey');
      
      const cleanup = () => {
        setWallet(null);
        setWalletType(null);
        setPublicKey(null);
        setConnected(false);
        localStorage.removeItem('walletConnected');
        localStorage.removeItem('walletType');
        localStorage.removeItem('walletPublicKey');
      };

      if (wasConnected && storedWalletType && storedPublicKey) {
        const walletAdapter = getWalletAdapter(storedWalletType);
        if (walletAdapter) {
          try {
            const response = await walletAdapter.connect({ onlyIfTrusted: true });
            
            const publicKeyFromAdapter = walletAdapter.publicKey || (response && response.publicKey);

            if (publicKeyFromAdapter && publicKeyFromAdapter.toString() === storedPublicKey) {
              const pubKey = new PublicKey(storedPublicKey);
              setWallet(walletAdapter);
              setWalletType(storedWalletType);
              setPublicKey(pubKey);
              setConnected(true);
            } else {
              cleanup();
            }
          } catch (error) {
            console.error('Auto-connect failed:', error);
            cleanup();
          }
        }
      }
    };

    autoConnect();
  }, [getWalletAdapter]);

  // Listen for wallet events
  useEffect(() => {
    if (wallet && walletType) {
      const handleDisconnect = () => {
        disconnect();
      };

      // Both Phantom and Solflare support the same event interface
      wallet.on('disconnect', handleDisconnect);
      
      return () => {
        wallet.off('disconnect', handleDisconnect);
      };
    }
  }, [wallet, walletType, disconnect]);

  const value: WalletContextType = {
    connected,
    connecting,
    publicKey,
    wallet,
    walletType,
    connect,
    disconnect,
    signMessage,
    signTransaction,
    availableWallets
  };

  return (
    <WalletContext.Provider value={value}>
      {children}
    </WalletContext.Provider>
  );
}

// Extend Window interface for Solana wallets
declare global {
  interface Window {
    solana?: {
      isPhantom?: boolean;
      publicKey?: { toString: () => string };
      connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
      disconnect: () => Promise<void>;
      signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
      signTransaction: (transaction: any) => Promise<any>;
      on: (event: string, callback: () => void) => void;
      off: (event: string, callback: () => void) => void;
    };
    solflare?: {
      isSolflare?: boolean;
      publicKey?: { toString: () => string };
      connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
      disconnect: () => Promise<void>;
      signMessage: (message: Uint8Array, encoding?: string) => Promise<{ signature: Uint8Array }>;
      signTransaction: (transaction: any) => Promise<any>;
      on: (event: string, callback: () => void) => void;
      off: (event: string, callback: () => void) => void;
    };
  }
}
