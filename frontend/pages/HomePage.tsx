import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Zap, Shield, Globe, Code, DollarSign, Users, CheckCircle } from 'lucide-react';
import { useWallet } from '../providers/WalletProvider';
import { APP_CONFIG, TOKEN_CREATION_FEE, NETWORK_CONFIG } from '../config';

export function HomePage() {
  const { connected } = useWallet();

  const features = [
    {
      icon: Zap,
      title: "Lightning Fast",
      description: "Deploy SPL tokens in seconds with our optimized infrastructure"
    },
    {
      icon: Shield,
      title: "Enterprise Security",
      description: "Multi-signature treasury and battle-tested smart contracts"
    },
    {
      icon: Globe,
      title: "Arweave Storage",
      description: "Permanent metadata storage with guaranteed availability"
    },
    {
      icon: Code,
      title: "Developer Friendly",
      description: "Clean APIs and comprehensive documentation"
    },
    {
      icon: DollarSign,
      title: "Transparent Pricing",
      description: `Simple ${TOKEN_CREATION_FEE} SOL fee per token with no hidden costs`
    },
    {
      icon: Users,
      title: "Community Driven",
      description: "Built by creators, for creators"
    }
  ];

  const stats = [
    { value: "1000+", label: "Tokens Created" },
    { value: "50+", label: "Active Projects" },
    { value: "99.9%", label: "Uptime" }
  ];

  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-4xl sm:text-6xl font-bold text-foreground mb-6">
            <span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              {APP_CONFIG.name}
            </span>
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            {APP_CONFIG.tagline}
          </p>
          <p className="text-lg text-muted-foreground mb-6 max-w-3xl mx-auto">
            {APP_CONFIG.description}
          </p>
          
          {/* Network Badge */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex items-center space-x-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 px-4 py-2 rounded-full">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Now Live on {NETWORK_CONFIG.displayName}</span>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {connected ? (
              <>
                <Button asChild size="lg" className="text-lg px-8">
                  <Link to="/create" className="flex items-center space-x-2">
                    <span>Create Your First Token ({TOKEN_CREATION_FEE} SOL)</span>
                    <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-lg px-8">
                  <Link to="/dashboard">View Dashboard</Link>
                </Button>
              </>
            ) : (
              <Button asChild size="lg" className="text-lg px-8">
                <Link to="/dashboard" className="flex items-center space-x-2">
                  <span>Get Started</span>
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Enterprise-Grade Token Creation
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Everything you need to create, manage, and scale your SPL tokens on {NETWORK_CONFIG.displayName}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card key={index} className="border-border">
                  <CardHeader>
                    <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <CardTitle className="text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center">
            {stats.map((stat, index) => (
              <div key={index}>
                <div className="text-4xl font-bold text-foreground mb-2">{stat.value}</div>
                <div className="text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Fair Mint Announcement */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-orange-500 to-red-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            🔥 Proof-of-Burn Fair Mint Coming Soon
          </h2>
          <p className="text-xl text-orange-100 mb-8">
            Burn your SPL tokens and receive SOLF pro-rata by USD value. No presale, no insiders - completely fair distribution.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-semibold text-white mb-2">How It Works</h3>
              <ul className="text-orange-100 text-sm space-y-1 text-left">
                <li>• Burn approved SPL tokens (no LPs)</li>
                <li>• Get SOLF based on USD value at burn time</li>
                <li>• 20% TGE, 80% vested over 30 days</li>
                <li>• True on-chain burns via SPL program</li>
              </ul>
            </div>
            <div className="bg-white/10 backdrop-blur rounded-lg p-6">
              <h3 className="font-semibold text-white mb-2">Fair Launch Rules</h3>
              <ul className="text-orange-100 text-sm space-y-1 text-left">
                <li>• 72-hour burn window</li>
                <li>• $2,500 max per transaction</li>
                <li>• $5,000 max per wallet</li>
                <li>• 90-second quote TTL</li>
              </ul>
            </div>
          </div>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8">
            <Link to="/fair-mint" className="flex items-center space-x-2">
              <span>Learn More About Fair Mint</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Simple, Transparent Pricing
          </h2>
          <Card className="max-w-md mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl">Token Creation</CardTitle>
              <div className="text-4xl font-bold text-foreground">
                {TOKEN_CREATION_FEE} SOL
              </div>
              <CardDescription>Per token deployed to {NETWORK_CONFIG.displayName}</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>✓ Deploy to {NETWORK_CONFIG.displayName}</li>
                <li>✓ Permanent metadata storage</li>
                <li>✓ Full token management</li>
                <li>✓ No hidden fees</li>
                <li>✓ 24/7 support</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-500 to-blue-500">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Launch Your Token?
          </h2>
          <p className="text-xl text-purple-100 mb-8">
            Join thousands of creators who trust {APP_CONFIG.name} for their token needs
          </p>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8">
            <Link to={connected ? "/create" : "/dashboard"} className="flex items-center space-x-2">
              <span>Start Creating</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </div>
  );
}
