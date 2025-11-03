import { ReactNode, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  component: ReactNode;
  validation?: () => boolean;
  optional?: boolean;
}

interface WizardFormProps {
  steps: WizardStep[];
  currentStep: number;
  onStepChange: (stepIndex: number) => void;
  onComplete: () => void;
  canProceed?: boolean;
  isCompleting?: boolean;
  completionText?: string;
}

export function WizardForm({
  steps,
  currentStep,
  onStepChange,
  onComplete,
  canProceed = true,
  isCompleting = false,
  completionText = "Create Negotiation"
}: WizardFormProps) {
  const isLastStep = currentStep === steps.length - 1;
  const isFirstStep = currentStep === 0;

  const handleNext = () => {
    if (isLastStep) {
      onComplete();
    } else {
      onStepChange(currentStep + 1);
    }
  };

  const handlePrevious = () => {
    if (!isFirstStep) {
      onStepChange(currentStep - 1);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Step Progress Header */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl">Configuration Progress</CardTitle>
          <div className="flex items-center gap-2 mt-4">
            {steps.map((step, index) => (
              <div key={step.id} className="flex items-center">
                <div
                  className={cn(
                    "flex items-center justify-center w-8 h-8 rounded-full text-sm font-medium transition-colors",
                    index < currentStep
                      ? "bg-primary text-white"
                      : index === currentStep
                      ? "bg-primary text-white ring-2 ring-primary ring-offset-2"
                      : "bg-gray-200 text-gray-600"
                  )}
                >
                  {index < currentStep ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={cn(
                      "w-12 h-px mx-2 transition-colors",
                      index < currentStep ? "bg-primary" : "bg-gray-200"
                    )}
                  />
                )}
              </div>
            ))}
          </div>
          <div className="mt-4">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                Step {currentStep + 1} of {steps.length}
              </Badge>
              {steps[currentStep]?.optional && (
                <Badge variant="secondary" className="text-xs">
                  Optional
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Current Step Content */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">
            {steps[currentStep]?.title}
          </CardTitle>
          {steps[currentStep]?.description && (
            <p className="text-gray-600">{steps[currentStep].description}</p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          {steps[currentStep]?.component}
        </CardContent>
      </Card>

      {/* Navigation Footer */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={isFirstStep}
              className="flex items-center gap-2"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </Button>

            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>Step {currentStep + 1} of {steps.length}</span>
            </div>

            <Button
              onClick={handleNext}
              disabled={!canProceed || isCompleting}
              className="flex items-center gap-2"
            >
              {isCompleting ? (
                isLastStep && completionText.includes("Update") ? "Updating..." : "Creating..."
              ) : isLastStep ? (
                completionText
              ) : (
                <>
                  Next
                  <ChevronRight className="w-4 h-4" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}