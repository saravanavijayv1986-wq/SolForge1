import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Wallet, Home, Plus, BarChart3, Map, Flame, Shield } from 'lucide-react';
import { useWallet } from '../../providers/WalletProvider';
import { WalletButton } from '../wallet/WalletButton';
import { APP_CONFIG, ADMIN_WALLET_ADDRESS } from '../../config';

export function AppHeader() {
  const location = useLocation();
  const { connected, publicKey } = useWallet();
  const isAdmin = connected && publicKey?.toString() === ADMIN_WALLET_ADDRESS;

  const navigation = [
    { name: 'Home', href: '/', icon: Home },
    { name: 'Dashboard', href: '/dashboard', icon: BarChart3, requiresWallet: true },
    { name: 'Create Token', href: '/create', icon: Plus, requiresWallet: true },
    { name: 'Fair Mint', href: '/fair-mint', icon: Flame },
    { name: 'Roadmap', href: '/roadmap', icon: Map },
  ];

  if (isAdmin) {
    navigation.push({ name: 'Admin', href: '/admin', icon: Shield, requiresWallet: true });
  }

  return (
    <header className="bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Brand */}
          <div className="flex items-center space-x-4">
            <Link to="/" className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                <Wallet className="h-5 w-5 text-white" />
              </div>
              <span className="font-bold text-xl text-foreground">{APP_CONFIG.name}</span>
            </Link>
          </div>

          {/* Navigation */}
          <nav className="hidden md:flex items-center space-x-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              const isDisabled = item.requiresWallet && !connected;
              
              return (
                <Button
                  key={item.name}
                  asChild={!isDisabled}
                  variant={isActive ? "default" : "ghost"}
                  size="sm"
                  disabled={isDisabled}
                  className="flex items-center space-x-2"
                >
                  {isDisabled ? (
                    <span className="flex items-center space-x-2 opacity-50">
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </span>
                  ) : (
                    <Link to={item.href} className="flex items-center space-x-2">
                      <Icon className="h-4 w-4" />
                      <span>{item.name}</span>
                    </Link>
                  )}
                </Button>
              );
            })}
          </nav>

          {/* Wallet Connection */}
          <div className="flex items-center space-x-4">
            <WalletButton />
          </div>
        </div>
      </div>
    </header>
  );
}
