import React from 'react';
import { Link } from 'react-router-dom';
import { APP_CONFIG, ADMIN_WALLET_ADDRESS } from '../../config';
import { useWallet } from '../../providers/WalletProvider';

export function AppFooter() {
  const { publicKey } = useWallet();
  const isAdmin = publicKey?.toString() === ADMIN_WALLET_ADDRESS;

  return (
    <footer className="bg-background border-t border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand */}
          <div className="col-span-1 md:col-span-2">
            <h3 className="font-bold text-lg text-foreground mb-2">{APP_CONFIG.name}</h3>
            <p className="text-muted-foreground text-sm mb-4">
              {APP_CONFIG.description}
            </p>
            <p className="text-xs text-muted-foreground">
              Version {APP_CONFIG.version} • Built on Solana Devnet
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-semibold text-foreground mb-3">Resources</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Documentation</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">API Reference</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Support</a></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-semibold text-foreground mb-3">Legal</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><a href="#" className="hover:text-foreground transition-colors">Privacy Policy</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Terms of Service</a></li>
              <li><a href="#" className="hover:text-foreground transition-colors">Security</a></li>
            </ul>
          </div>
        </div>

        <div className="mt-8 pt-8 border-t border-border">
          <p className="text-center text-xs text-muted-foreground">
            © 2024 {APP_CONFIG.name}. All rights reserved. Built with Encore.ts and React.
          </p>
          {isAdmin && (
            <div className="text-center mt-4">
              <Link to="/admin" className="text-sm text-purple-500 hover:underline">
                Admin Panel
              </Link>
            </div>
          )}
        </div>
      </div>
    </footer>
  );
}
