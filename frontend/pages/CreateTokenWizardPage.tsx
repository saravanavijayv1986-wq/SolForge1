import React, { useState } from 'react';
import { Wallet } from 'lucide-react';
import { useWallet } from '@solana/wallet-adapter-react';
import { WizardErrorBoundary } from '../components/wizard/ErrorBoundary';
import { WizardProgress } from '../components/wizard/WizardProgress';
import { WizardContainer } from '../components/wizard/WizardContainer';
import { WizardNavigation } from '../components/wizard/WizardNavigation';
import { WalletConnectionStep } from '../components/wizard/WalletConnectionStep';
import { TokenInfoStep } from '../components/wizard/TokenInfoStep';
import { SupplySettingsStep } from '../components/wizard/SupplySettingsStep';
import { MetadataStep } from '../components/wizard/MetadataStep';
import { ReviewStep } from '../components/wizard/ReviewStep';
import { SuccessStep } from '../components/wizard/SuccessStep';
import { FeePreviewBox } from '../components/wizard/FeePreviewBox';
import { TokenWizardProvider, useTokenWizard } from '../providers/TokenWizardProvider';

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
  const { currentStep, setCurrentStep, isCreating, creationResult, formData } = useTokenWizard();

  // Show success screen if token creation is complete
  if (creationResult) {
    return <SuccessStep />;
  }

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

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return connected;
      case 2:
        return !!(formData.name && formData.symbol && formData.decimals !== undefined);
      case 3:
        return !!(formData.initialSupply && formData.supplyType);
      case 4:
        return true; // Metadata is optional
      case 5:
        return !!(formData.name && formData.symbol && formData.initialSupply);
      default:
        return false;
    }
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return <WalletConnectionStep />;
      case 2:
        return <TokenInfoStep />;
      case 3:
        return <SupplySettingsStep />;
      case 4:
        return <MetadataStep />;
      case 5:
        return <ReviewStep />;
      default:
        return <div>Invalid step</div>;
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Create SPL Token</h1>
          <p className="text-muted-foreground">
            Deploy your SPL token on Solana with our step-by-step wizard
          </p>
        </div>

        {/* Progress */}
        <WizardProgress steps={steps} currentStep={currentStep} />

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3">
            <WizardErrorBoundary>
              <WizardContainer 
                steps={steps} 
                currentStep={currentStep}
                icon={<Wallet className="h-5 w-5" />}
              >
                {renderStepContent()}

                <WizardNavigation
                  currentStep={currentStep}
                  totalSteps={steps.length}
                  onNext={nextStep}
                  onPrev={prevStep}
                  canProceed={canProceed()}
                  isProcessing={isCreating}
                  showNext={currentStep < steps.length}
                  showPrev={currentStep > 1}
                />
              </WizardContainer>
            </WizardErrorBoundary>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <FeePreviewBox />
            
            {/* Help Card - Enhanced */}
            <div className="space-y-4">
              {/* Quick Help */}
              <div className="bg-muted rounded-lg p-4">
                <h4 className="font-semibold mb-2">Quick Tips</h4>
                <div className="text-sm space-y-2">
                  {currentStep === 1 && (
                    <p className="text-muted-foreground">
                      Make sure you have at least 0.15 SOL for token creation and fees
                    </p>
                  )}
                  {currentStep === 2 && (
                    <p className="text-muted-foreground">
                      Choose a unique name and symbol. These cannot be changed later.
                    </p>
                  )}
                  {currentStep === 3 && (
                    <p className="text-muted-foreground">
                      Fixed supply prevents minting more tokens. Mintable allows future expansion.
                    </p>
                  )}
                  {currentStep === 4 && (
                    <p className="text-muted-foreground">
                      Upload a logo to make your token more recognizable in wallets.
                    </p>
                  )}
                  {currentStep === 5 && (
                    <p className="text-muted-foreground">
                      Review all settings carefully. Token creation is irreversible.
                    </p>
                  )}
                </div>
              </div>

              {/* Progress Indicator */}
              {formData.name && formData.symbol && (
                <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">
                    Token Preview
                  </h4>
                  <div className="text-sm space-y-1">
                    <div className="font-medium">{formData.name}</div>
                    <div className="text-green-600 dark:text-green-400">{formData.symbol}</div>
                    {formData.initialSupply && (
                      <div className="text-muted-foreground">
                        Supply: {parseFloat(formData.initialSupply).toLocaleString()}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
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
