import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle, 
  Circle, 
  Clock, 
  Wallet, 
  Coins, 
  TrendingUp, 
  Repeat, 
  Rocket, 
  Vote,
  Users,
  Shield,
  Zap,
  Globe,
  Code,
  DollarSign,
  Flame,
  BarChart3,
  Layers,
  Target
} from 'lucide-react';
import { APP_CONFIG, NETWORK_CONFIG } from '../config';

interface RoadmapPhase {
  id: number;
  title: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  features: string[];
  quarter?: string;
}

const roadmapPhases: RoadmapPhase[] = [
  {
    id: 1,
    title: 'Foundation & Token Creation',
    status: 'completed',
    description: 'Core infrastructure and SPL token creation platform',
    icon: Shield,
    quarter: 'Q4 2024',
    features: [
      'Solana Mainnet deployment with enterprise infrastructure',
      'SPL token creation with Arweave metadata storage',
      'Real-time wallet balance checking and transaction verification',
      'Comprehensive Solana network error handling',
      'Multi-signature treasury and 0.1 SOL fee system',
      'Token management: minting, transfers, and statistics'
    ]
  },
  {
    id: 2,
    title: 'Proof-of-Burn Fair Mint',
    status: 'completed',
    description: 'Revolutionary fair distribution mechanism via SPL token burning',
    icon: Flame,
    quarter: 'Q4 2024',
    features: [
      'True SPL token burns (not transfers) with on-chain verification',
      'Pro-rata SOLF allocation based on USD value at burn time',
      'Real-time pricing via Pyth oracles with DEX fallbacks',
      '90-second quote TTL with comprehensive safety caps',
      'Admin dashboard for curating accepted tokens',
      'Leaderboards, statistics, and user burn history'
    ]
  },
  {
    id: 3,
    title: 'SOLF Staking & Rewards',
    status: 'in-progress',
    description: 'Native token staking with rewards and governance participation',
    icon: TrendingUp,
    quarter: 'Q1 2025',
    features: [
      'Stake SOLF for 3/6/12 months with tiered rewards',
      'Automated reward distribution and compound staking',
      'Staking dashboard with real-time APY calculations',
      'Smart contract-driven staking with penalty protection',
      'Governance weight based on staked amount and duration'
    ]
  },
  {
    id: 4,
    title: 'DEX Integration & Trading',
    status: 'upcoming',
    description: 'Seamless token swapping with integrated liquidity',
    icon: Repeat,
    quarter: 'Q1 2025',
    features: [
      'Jupiter integration for SOLF ↔ SOL swaps',
      'Cross-token swapping with minimal slippage',
      'Automated market making for SOLF pairs',
      'Advanced trading interface with charts and analytics',
      'Transparent fee structure with auto-compounding'
    ]
  },
  {
    id: 5,
    title: 'Launchpad & IDO Platform',
    status: 'upcoming',
    description: 'Token launchpad for vetted projects with SOLF staking requirements',
    icon: Rocket,
    quarter: 'Q2 2025',
    features: [
      'Curated project launches with due diligence',
      'Tiered allocation: ≥10,000 SOLF staked to participate',
      'Automated vesting and liquidity bootstrapping',
      'Creator dashboard for managing token sales',
      'Community voting on project inclusions'
    ]
  },
  {
    id: 6,
    title: 'Advanced Analytics & Tools',
    status: 'upcoming',
    description: 'Professional-grade analytics and portfolio management',
    icon: BarChart3,
    quarter: 'Q2 2025',
    features: [
      'Real-time portfolio tracking across all SPL tokens',
      'Advanced charting with technical indicators',
      'Yield farming opportunities discovery',
      'Risk assessment and portfolio optimization',
      'API access for institutional users'
    ]
  },
  {
    id: 7,
    title: 'Governance & DAO',
    status: 'upcoming',
    description: 'Community governance and decentralized decision making',
    icon: Vote,
    quarter: 'Q3 2025',
    features: [
      'On-chain governance for platform parameters',
      'Treasury management with community oversight',
      'Proposal system with executable smart contracts',
      'Delegation and vote escrow mechanisms',
      'Revenue sharing for SOLF stakers'
    ]
  },
  {
    id: 8,
    title: 'Cross-Chain & Ecosystem',
    status: 'upcoming',
    description: 'Multi-chain expansion and ecosystem partnerships',
    icon: Layers,
    quarter: 'Q4 2025',
    features: [
      'Ethereum and Base chain integration',
      'Cross-chain bridge for SOLF token',
      'Multi-chain portfolio management',
      'Strategic DeFi protocol partnerships',
      'Institutional custody solutions'
    ]
  }
];

const currentFeatures = [
  {
    icon: Zap,
    title: 'Lightning Fast',
    description: 'Deploy SPL tokens in seconds'
  },
  {
    icon: Globe,
    title: 'Mainnet Ready',
    description: `Live on ${NETWORK_CONFIG.displayName}`
  },
  {
    icon: Flame,
    title: 'Fair Mint Live',
    description: 'Proof-of-Burn distribution system'
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description: 'Multi-sig treasury and verified contracts'
  },
  {
    icon: Code,
    title: 'Developer Friendly',
    description: 'Clean APIs and comprehensive docs'
  },
  {
    icon: DollarSign,
    title: 'Transparent Pricing',
    description: 'Simple 0.1 SOL fee per token'
  }
];

const keyMetrics = [
  {
    icon: Target,
    title: 'Vision',
    description: 'Become the premier SPL token platform',
    value: '2025 Goal'
  },
  {
    icon: Users,
    title: 'Community',
    description: 'Active token creators and holders',
    value: '10,000+'
  },
  {
    icon: Coins,
    title: 'Tokens',
    description: 'SPL tokens created via platform',
    value: '1,000+'
  },
  {
    icon: TrendingUp,
    title: 'TVL Target',
    description: 'Total value locked in ecosystem',
    value: '$10M+'
  }
];

export function RoadmapPage() {
  const getStatusIcon = (status: RoadmapPhase['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-6 w-6 text-green-500" />;
      case 'in-progress':
        return <Clock className="h-6 w-6 text-blue-500" />;
      case 'upcoming':
        return <Circle className="h-6 w-6 text-muted-foreground" />;
    }
  };

  const getStatusBadge = (status: RoadmapPhase['status']) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">Completed</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">In Progress</Badge>;
      case 'upcoming':
        return <Badge variant="outline">Upcoming</Badge>;
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-4">
            <span className="bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
              {APP_CONFIG.name} Roadmap 2025
            </span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            From mainnet launch to becoming the premier SPL token ecosystem on Solana
          </p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {keyMetrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card key={index} className="text-center">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{metric.title}</h3>
                  <p className="text-2xl font-bold text-foreground mb-2">{metric.value}</p>
                  <p className="text-sm text-muted-foreground">{metric.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Current Status */}
        <Card className="mb-12 border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2 text-green-800 dark:text-green-200">
              <CheckCircle className="h-5 w-5" />
              <span>Now Live on {NETWORK_CONFIG.displayName}</span>
            </CardTitle>
            <CardDescription className="text-green-700 dark:text-green-300">
              Production-ready features available today
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {currentFeatures.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-green-200 dark:bg-green-800 rounded-lg flex items-center justify-center">
                      <Icon className="h-4 w-4 text-green-700 dark:text-green-300" />
                    </div>
                    <div>
                      <h4 className="font-medium text-green-800 dark:text-green-200">{feature.title}</h4>
                      <p className="text-sm text-green-600 dark:text-green-400">{feature.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Development Phases */}
        <div className="space-y-8">
          <h2 className="text-2xl font-bold text-foreground text-center mb-8">Development Roadmap</h2>
          
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-border hidden lg:block" />
            
            {roadmapPhases.map((phase, index) => {
              const Icon = phase.icon;
              
              return (
                <div key={phase.id} className="relative">
                  {/* Timeline dot */}
                  <div className="absolute left-6 top-8 w-4 h-4 rounded-full bg-background border-2 border-border hidden lg:block">
                    <div className={`absolute inset-0.5 rounded-full ${
                      phase.status === 'completed' ? 'bg-green-500' :
                      phase.status === 'in-progress' ? 'bg-blue-500' : 'bg-muted-foreground'
                    }`} />
                  </div>
                  
                  <Card className={`lg:ml-16 mb-8 ${
                    phase.status === 'completed' ? 'border-green-200 bg-green-50/50 dark:border-green-800 dark:bg-green-950/50' :
                    phase.status === 'in-progress' ? 'border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/50' :
                    'border-border'
                  }`}>
                    <CardHeader>
                      <div className="flex items-center justify-between flex-wrap gap-4">
                        <div className="flex items-center space-x-3">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            phase.status === 'completed' ? 'bg-green-100 dark:bg-green-900' :
                            phase.status === 'in-progress' ? 'bg-blue-100 dark:bg-blue-900' :
                            'bg-muted'
                          }`}>
                            <Icon className={`h-6 w-6 ${
                              phase.status === 'completed' ? 'text-green-600 dark:text-green-400' :
                              phase.status === 'in-progress' ? 'text-blue-600 dark:text-blue-400' :
                              'text-muted-foreground'
                            }`} />
                          </div>
                          <div>
                            <CardTitle className="flex items-center space-x-2">
                              <span>{phase.title}</span>
                            </CardTitle>
                            <CardDescription className="flex items-center space-x-2">
                              <span>{phase.description}</span>
                              {phase.quarter && (
                                <Badge variant="outline" className="ml-2">
                                  {phase.quarter}
                                </Badge>
                              )}
                            </CardDescription>
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          {getStatusBadge(phase.status)}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {phase.features.map((feature, featureIndex) => (
                          <li key={featureIndex} className="flex items-start space-x-2">
                            {getStatusIcon(phase.status)}
                            <span className="text-sm">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* SOLF Token Ecosystem */}
        <Card className="mt-12">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Coins className="h-5 w-5 text-purple-500" />
              <span>SOLF Token Ecosystem</span>
            </CardTitle>
            <CardDescription>
              The utility token powering the entire SolForge ecosystem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <h4 className="font-semibold mb-3 flex items-center space-x-2">
                  <Flame className="h-4 w-4 text-orange-500" />
                  <span>Fair Distribution</span>
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Proof-of-Burn fair mint (no presale)</li>
                  <li>• Pro-rata allocation by USD burned</li>
                  <li>• 20% TGE, 80% vested over 30 days</li>
                  <li>• Transparent on-chain distribution</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3 flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-blue-500" />
                  <span>Staking Benefits</span>
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Earn rewards for long-term staking</li>
                  <li>• Multiple periods: 3, 6, 12 months</li>
                  <li>• Governance voting power</li>
                  <li>• Platform fee revenue sharing</li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-3 flex items-center space-x-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span>Premium Access</span>
                </h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Launchpad participation (≥10K SOLF)</li>
                  <li>• Advanced analytics dashboard</li>
                  <li>• Priority customer support</li>
                  <li>• Early access to new features</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Community & Ecosystem Growth */}
        <Card className="mt-12">
          <CardHeader>
            <CardTitle>Community & Ecosystem Growth</CardTitle>
            <CardDescription>
              Building a sustainable and thriving SPL token ecosystem
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div>
                <h4 className="font-semibold mb-4">Developer Ecosystem</h4>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Open-source smart contracts and SDKs</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Clock className="h-4 w-4 text-blue-500 mt-0.5" />
                    <span>Comprehensive API documentation</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>Developer grants and hackathons</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>Third-party integrations marketplace</span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4">Strategic Partnerships</h4>
                <ul className="space-y-3 text-sm">
                  <li className="flex items-start space-x-2">
                    <CheckCircle className="h-4 w-4 text-green-500 mt-0.5" />
                    <span>Jupiter integration for DEX routing</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>Major DeFi protocol integrations</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>Institutional custody partnerships</span>
                  </li>
                  <li className="flex items-start space-x-2">
                    <Circle className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>Cross-chain bridge collaborations</span>
                  </li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="text-center mt-12 p-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg">
          <h3 className="text-2xl font-bold text-white mb-4">
            Join the {APP_CONFIG.name} Revolution
          </h3>
          <p className="text-purple-100 mb-6 max-w-2xl mx-auto">
            Be part of the future of SPL tokens on Solana. Create tokens, participate in fair mints, 
            and help build the most comprehensive token ecosystem.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a 
              href="/create" 
              className="bg-white text-purple-600 font-medium px-6 py-3 rounded-lg hover:bg-gray-100 transition-colors"
            >
              Create Your First Token
            </a>
            <a 
              href="/fair-mint" 
              className="border border-white text-white font-medium px-6 py-3 rounded-lg hover:bg-white/10 transition-colors"
            >
              Join Fair Mint
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
