import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { WalletProvider } from './providers/WalletProvider';
import { Toaster } from '@/components/ui/toaster';
import { AppHeader } from './components/layout/AppHeader';
import { AppFooter } from './components/layout/AppFooter';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateTokenPage } from './pages/CreateTokenPage';
import { FairMintPage } from './pages/FairMintPage';
import { RoadmapPage } from './pages/RoadmapPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function AppInner() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader />
      <main className="flex-1">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/create" element={<CreateTokenPage />} />
          <Route path="/fair-mint" element={<FairMintPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />
        </Routes>
      </main>
      <AppFooter />
      <Toaster />
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <Router>
          <AppInner />
        </Router>
      </WalletProvider>
    </QueryClientProvider>
  );
}
