import React from 'react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';

export function WalletButton() {
  return (
    <WalletMultiButton 
      style={{
        backgroundColor: '#6366f1',
        borderRadius: '0.5rem',
        fontSize: '0.875rem',
        padding: '0.5rem 1rem',
      }}
    />
  );
}
