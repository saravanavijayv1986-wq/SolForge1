import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  onNext: () => void;
  onPrev: () => void;
  canProceed: boolean;
  isProcessing?: boolean;
  nextLabel?: string;
  prevLabel?: string;
  showNext?: boolean;
  showPrev?: boolean;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  onNext,
  onPrev,
  canProceed,
  isProcessing = false,
  nextLabel = "Next",
  prevLabel = "Previous",
  showNext = true,
  showPrev = true
}: WizardNavigationProps) {
  return (
    <div className="flex justify-between mt-8 pt-6 border-t">
      {showPrev ? (
        <Button
          variant="outline"
          onClick={onPrev}
          disabled={currentStep === 1 || isProcessing}
          className="flex items-center space-x-2"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{prevLabel}</span>
        </Button>
      ) : (
        <div />
      )}

      {showNext && currentStep < totalSteps && (
        <Button
          onClick={onNext}
          disabled={!canProceed || isProcessing}
          className="flex items-center space-x-2"
        >
          {isProcessing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <span>{nextLabel}</span>
          {!isProcessing && <ArrowRight className="h-4 w-4" />}
        </Button>
      )}
    </div>
  );
}
