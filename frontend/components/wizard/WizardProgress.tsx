import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { CheckCircle, Circle } from 'lucide-react';

interface WizardStep {
  id: number;
  name: string;
  description: string;
}

interface WizardProgressProps {
  steps: WizardStep[];
  currentStep: number;
}

export function WizardProgress({ steps, currentStep }: WizardProgressProps) {
  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;
  const currentStepData = steps.find(step => step.id === currentStep);

  return (
    <div className="mb-8">
      <div className="flex justify-between items-center mb-4">
        <span className="text-sm font-medium text-foreground">
          Step {currentStep} of {steps.length}
        </span>
        <Badge variant="outline">
          {currentStepData?.name}
        </Badge>
      </div>
      <Progress value={progress} className="w-full mb-4" />
      
      {/* Step Labels */}
      <div className="hidden md:flex justify-between text-xs text-muted-foreground">
        {steps.map((step) => (
          <div key={step.id} className="flex flex-col items-center max-w-20">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 mb-1 transition-colors ${
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
            <span className={`text-center truncate w-full ${
              step.id === currentStep ? 'font-medium' : ''
            }`}>
              {step.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
