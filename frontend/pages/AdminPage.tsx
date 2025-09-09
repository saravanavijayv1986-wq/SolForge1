import React, { useState, useEffect } from 'react';
import { useWallet } from '../providers/WalletProvider';
import { CreateFairMintForm } from '../components/admin/CreateFairMintForm';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle, Shield, Loader2 } from 'lucide-react';
import backend from '~backend/client';

export function AdminPage() {
  const { connected, publicKey } = useWallet();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAdmin = async () => {
      setIsLoading(true);
      if (connected && publicKey) {
        try {
          const res = await backend.fairmint.getAdminWallet();
          setIsAdmin(publicKey.toString() === res.adminWallet);
        } catch {
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      setIsLoading(false);
    };
    checkAdmin();
  }, [connected, publicKey]);

  if (!connected) {
    return <WalletConnectPrompt />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Verifying admin access...</span>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              <span>Access Denied</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p>You are not authorized to view this page.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
            <Shield className="h-8 w-8 text-purple-500" />
            <span>Fair Mint Admin Panel</span>
          </h1>
          <p className="text-muted-foreground mt-1">
            Create and manage Proof-of-Burn Fair Mint events.
          </p>
        </div>
        <CreateFairMintForm />
      </div>
    </div>
  );
}
