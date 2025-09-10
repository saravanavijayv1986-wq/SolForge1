import React, { createContext, useContext, useState, ReactNode } from 'react';
import { TokenFormData } from '../pages/CreateTokenWizardPage';

interface TokenCreationResult {
  mint: string;
  signature: string;
  ata?: string;
  metadataUrl?: string;
}

interface TokenWizardContextType {
  currentStep: number;
  setCurrentStep: (step: number) => void;
  formData: Partial<TokenFormData>;
  updateFormData: (data: Partial<TokenFormData>) => void;
  resetWizard: () => void;
  isCreating: boolean;
  setIsCreating: (creating: boolean) => void;
  creationResult: TokenCreationResult | null;
  setCreationResult: (result: TokenCreationResult | null) => void;
}

const TokenWizardContext = createContext<TokenWizardContextType | undefined>(undefined);

export function useTokenWizard() {
  const context = useContext(TokenWizardContext);
  if (!context) {
    throw new Error('useTokenWizard must be used within a TokenWizardProvider');
  }
  return context;
}

interface TokenWizardProviderProps {
  children: ReactNode;
}

export function TokenWizardProvider({ children }: TokenWizardProviderProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<Partial<TokenFormData>>({
    decimals: 9,
    supplyType: 'fixed',
    isBurnable: false,
    hasFreezeAuthority: false,
  });
  const [isCreating, setIsCreating] = useState(false);
  const [creationResult, setCreationResult] = useState<TokenCreationResult | null>(null);

  const updateFormData = (data: Partial<TokenFormData>) => {
    setFormData(prev => ({ ...prev, ...data }));
  };

  const resetWizard = () => {
    setCurrentStep(1);
    setFormData({
      decimals: 9,
      supplyType: 'fixed',
      isBurnable: false,
      hasFreezeAuthority: false,
    });
    setIsCreating(false);
    setCreationResult(null);
  };

  return (
    <TokenWizardContext.Provider value={{
      currentStep,
      setCurrentStep,
      formData,
      updateFormData,
      resetWizard,
      isCreating,
      setIsCreating,
      creationResult,
      setCreationResult,
    }}>
      {children}
    </TokenWizardContext.Provider>
  );
}
