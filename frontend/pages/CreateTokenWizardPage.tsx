import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, ArrowRight, CheckCircle, ExternalLink, Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WalletConnectPrompt } from '../components/wallet/WalletConnectPrompt';
import { WalletConnectionStep } from '../components/wizard/WalletConnectionStep';
import { TokenInfoStep } from '../components/wizard/TokenInfoStep';
import { SupplySettingsStep } from '../components/wizard/SupplySettingsStep';
import { MetadataStep } from '../components/wizard/MetadataStep';
import { ReviewStep } from '../components/wizard/ReviewStep';
import { SuccessStep } from '../components/wizard/SuccessStep';
import { FeePreviewBox } from '../components/wizard/FeePreviewBox';
import { TokenWizardProvider, useTokenWizard } from '../providers/TokenWizardProvider';
import { APP_CONFIG, NETWORK_CONFIG } from '../config';

export interface TokenFormData {
  // Token Info
  name: string;
  symbol: string;
  decimals: number;
  
  // Supply Settings
  supplyType: 'fixed' | 'mintable';
  initialSupply: string;
  maxSupply?: string;
  isBurnable: boolean;
  hasFreezeAuthority: boolean;
  
  // Metadata
  description?: string;
  logoFile?: File;
  logoUrl?: string;
  website?: string;
  twitter?: string;
  telegram?: string;
  discord?: string;
  
  // Internal
  metadataUrl?: string;
  imageTransactionId?: string;
  metadataTransactionId?: string;
}

const steps = [
  { id: 1, name: 'Connect Wallet', description: 'Connect your Solana wallet' },
  { id: 2, name: 'Token Info', description: 'Basic token information' },
  { id: 3, name: 'Supply Settings', description: 'Configure token supply' },
  { id: 4, name: 'Metadata', description: 'Upload logo and details' },
  { id: 5, name: 'Review', description: 'Review and confirm' },
];

function CreateTokenWizardContent() {
  const { connected } = useWallet();
  const { currentStep, setCurrentStep, isCreating, creationResult } = useTokenWizard();

  const currentStepData = steps.find(step => step.id === currentStep);
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  const nextStep = () => {
    if (currentStep < steps.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  // Show success screen if token creation is complete
  if (creationResult) {
    return <SuccessStep />;
  }

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create SPL Token</h1>
          <p className="text-muted-foreground">
            Deploy your SPL token on {NETWORK_CONFIG.displayName} with our step-by-step wizard
          </p>
        </div>

        {/* Progress Bar */}
        <div className="mb-8">
          <div className="flex justify-between items-center mb-4">
            <span className="text-sm font-medium text-foreground">
              Step {currentStep} of {steps.length}
            </span>
            <Badge variant="outline">
              {currentStepData?.name}
            </Badge>
          </div>
          <Progress value={progress} className="w-full" />
          
          {/* Step Labels */}
          <div className="flex justify-between mt-4 text-xs text-muted-foreground">
            {steps.map((step) => (
              <div key={step.id} className="flex flex-col items-center">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-1 ${
                  step.id < currentStep 
                    ? 'bg-green-500 border-green-500 text-white' 
                    : step.id === currentStep
                    ? 'border-blue-500 text-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-muted-foreground text-muted-foreground'
                }`}>
                  {step.id < currentStep ? (
                    <CheckCircle className="h-4 w-4" />
                  ) : (
                    <span className="text-xs font-medium">{step.id}</span>
                  )}
                </div>
                <span className={`text-center max-w-20 ${
                  step.id === currentStep ? 'font-medium' : ''
                }`}>
                  {step.name}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Wallet className="h-5 w-5" />
                  <span>{currentStepData?.name}</span>
                </CardTitle>
                <CardDescription>{currentStepData?.description}</CardDescription>
              </CardHeader>
              <CardContent>
                {currentStep === 1 && <WalletConnectionStep />}
                {currentStep === 2 && <TokenInfoStep />}
                {currentStep === 3 && <SupplySettingsStep />}
                {currentStep === 4 && <MetadataStep />}
                {currentStep === 5 && <ReviewStep />}

                {/* Navigation */}
                <div className="flex justify-between mt-8 pt-6 border-t">
                  <Button
                    variant="outline"
                    onClick={prevStep}
                    disabled={currentStep === 1 || isCreating}
                    className="flex items-center space-x-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span>Previous</span>
                  </Button>

                  {currentStep < steps.length && (
                    <Button
                      onClick={nextStep}
                      disabled={!connected || (currentStep === 1 && !connected)}
                      className="flex items-center space-x-2"
                    >
                      <span>Next</span>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <FeePreviewBox />
            
            {/* Help */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Need Help?</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div>
                    <h4 className="font-medium mb-1">Token Standards</h4>
                    <p className="text-muted-foreground">
                      All tokens follow SPL Token standards on Solana
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Metadata Storage</h4>
                    <p className="text-muted-foreground">
                      Images and metadata stored permanently on Arweave
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium mb-1">Network</h4>
                    <p className="text-muted-foreground">
                      Deploying to {NETWORK_CONFIG.displayName}
                    </p>
                  </div>
                </div>
                <Button variant="outline" size="sm" className="w-full mt-4">
                  <ExternalLink className="h-3 w-3 mr-2" />
                  View Documentation
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CreateTokenWizardPage() {
  return (
    <TokenWizardProvider>
      <CreateTokenWizardContent />
    </TokenWizardProvider>
  );
}
