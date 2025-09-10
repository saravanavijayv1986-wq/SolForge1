import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

interface WizardStep {
  id: number;
  name: string;
  description: string;
}

interface WizardContainerProps {
  steps: WizardStep[];
  currentStep: number;
  children: React.ReactNode;
  icon?: React.ReactNode;
}

export function WizardContainer({ steps, currentStep, children, icon }: WizardContainerProps) {
  const currentStepData = steps.find(step => step.id === currentStep);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {icon}
          <span>{currentStepData?.name}</span>
        </CardTitle>
        <CardDescription>{currentStepData?.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}
