import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRight, Zap, Shield, Globe, Code, DollarSign, Users, CheckCircle, Rocket, Coins, Target } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { APP_CONFIG, TOKEN_CREATION_FEE, NETWORK_CONFIG } from '../config';

export function HomePage() {
  const { connected } = useWallet();

  const features = [
    {
      icon: Rocket,
      title: "SOLF Launchpad",
      description: "Get SOLF tokens with SOL at 10,000:1 rate from fixed 250M treasury"
    },
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
      title: "Local Storage",
      description: "Efficient local metadata storage with optional external hosting"
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
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/launchpad" className="flex items-center space-x-2">
                <Rocket className="h-5 w-5" />
                <span>Buy SOLF Tokens</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            {connected ? (
              <>
                <Button asChild variant="outline" size="lg" className="text-lg px-8">
                  <Link to="/create">Create Token</Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="text-lg px-8">
                  <Link to="/dashboard">View Dashboard</Link>
                </Button>
              </>
            ) : (
              <Button asChild variant="outline" size="lg" className="text-lg px-8">
                <Link to="/dashboard">Connect Wallet</Link>
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

      {/* SOLF Launchpad Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-purple-500 to-blue-500">
        <div className="max-w-4xl mx-auto text-center">
          <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center mx-auto mb-6">
            <Rocket className="h-8 w-8 text-purple-500" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">
            SOLF Token Launchpad
          </h2>
          <p className="text-xl text-purple-100 mb-6">
            Get SOLF tokens with SOL at a fixed rate of 1 SOL = 10,000 SOLF from our dedicated treasury
          </p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="bg-white/10 rounded-lg p-4 text-white">
              <div className="text-2xl font-bold">500M</div>
              <div className="text-sm text-purple-100">Max Supply</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-white">
              <div className="text-2xl font-bold">250M</div>
              <div className="text-sm text-purple-100">Treasury (50%)</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-white">
              <div className="text-2xl font-bold">10,000</div>
              <div className="text-sm text-purple-100">SOLF per SOL</div>
            </div>
            <div className="bg-white/10 rounded-lg p-4 text-white">
              <div className="text-2xl font-bold">25K</div>
              <div className="text-sm text-purple-100">SOL Capacity</div>
            </div>
          </div>
          <Button asChild size="lg" variant="secondary" className="text-lg px-8">
            <Link to="/launchpad" className="flex items-center space-x-2">
              <span>Buy SOLF Now</span>
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Tokenomics Overview */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              SOLF Tokenomics
            </h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Fixed supply, transparent allocation, and permanent scarcity through revoked mint authority
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Supply Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Target className="h-5 w-5 text-purple-500" />
                  <span>Supply Distribution</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-purple-50 dark:bg-purple-950 rounded-lg">
                    <span className="font-medium">Treasury (Launchpad)</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-purple-600">250M</span>
                      <span className="text-sm text-muted-foreground block">50%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950 rounded-lg">
                    <span className="font-medium">Team & Operations</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-blue-600">100M</span>
                      <span className="text-sm text-muted-foreground block">20%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950 rounded-lg">
                    <span className="font-medium">Liquidity Pool</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-green-600">100M</span>
                      <span className="text-sm text-muted-foreground block">20%</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center p-3 bg-orange-50 dark:bg-orange-950 rounded-lg">
                    <span className="font-medium">Reserve/Partnerships</span>
                    <div className="text-right">
                      <span className="text-lg font-bold text-orange-600">50M</span>
                      <span className="text-sm text-muted-foreground block">10%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Key Features */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-green-500" />
                  <span>Supply Security</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Hard Cap Enforced</h4>
                      <p className="text-sm text-muted-foreground">500M max supply with mint authority permanently revoked</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Transparent Allocation</h4>
                      <p className="text-sm text-muted-foreground">All wallets publicly auditable on Solana Explorer</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">No Inflation Risk</h4>
                      <p className="text-sm text-muted-foreground">No new tokens can ever be created</p>
                    </div>
                  </div>
                  <div className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Fair Distribution</h4>
                      <p className="text-sm text-muted-foreground">No presale, equal access through launchpad</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
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
                <li>✓ Local metadata storage</li>
                <li>✓ Full token management</li>
                <li>✓ No hidden fees</li>
                <li>✓ 24/7 support</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl font-bold text-foreground mb-4">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of creators who trust {APP_CONFIG.name} for their token needs
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button asChild size="lg" className="text-lg px-8">
              <Link to="/launchpad" className="flex items-center space-x-2">
                <Rocket className="h-5 w-5" />
                <span>Buy SOLF</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="text-lg px-8">
              <Link to={connected ? "/create" : "/dashboard"} className="flex items-center space-x-2">
                <span>Create Token</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
