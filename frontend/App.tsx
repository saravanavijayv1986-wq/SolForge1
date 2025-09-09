import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { AppHeader } from './components/layout/AppHeader';
import { AppFooter } from './components/layout/AppFooter';
import { HomePage } from './pages/HomePage';
import { DashboardPage } from './pages/DashboardPage';
import { CreateTokenPage } from './pages/CreateTokenPage';
import { LaunchpadPage } from './pages/LaunchpadPage';
import { RoadmapPage } from './pages/RoadmapPage';
import { SolanaProviders } from './providers/SolanaProviders';
import '@solana/wallet-adapter-react-ui/styles.css';

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
          <Route path="/launchpad" element={<LaunchpadPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/create" element={<CreateTokenPage />} />
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
      <SolanaProviders>
        <Router>
          <AppInner />
        </Router>
      </SolanaProviders>
    </QueryClientProvider>
  );
}
