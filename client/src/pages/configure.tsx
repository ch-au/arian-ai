import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { WizardForm, WizardStep } from "@/components/wizard-form";
import { BasicContextStep, DimensionsStep, TechniquesStep, TacticsStep, CounterpartStep, NegotiationConfig, DimensionConfig } from "@/components/negotiation-config-steps";
import { useToast } from "@/hooks/use-toast";

const initialConfig: NegotiationConfig = {
  title: "",
  userRole: "",
  negotiationType: "",
  relationshipType: "",
  productMarketDescription: "",
  additionalComments: "",
  dimensions: [],
  selectedTechniques: [],
  selectedTactics: [],
  counterpartPersonality: "",
  zopaDistance: ""
};

export default function Configure() {
  const [location, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<NegotiationConfig>(initialConfig);
  const [isCompleting, setIsCompleting] = useState(false);
  const { toast } = useToast();
  
  // Parse URL parameters to detect edit mode
  const urlParams = new URLSearchParams(typeof window !== 'undefined' ? window.location.search : '');
  const editId = urlParams.get('edit');
  const isEditMode = !!editId;
  
  // Load existing negotiation data if in edit mode
  const { data: existingNegotiation, isLoading: isLoadingExisting } = useQuery<any>({
    queryKey: [`/api/negotiations/${editId}`],
    enabled: isEditMode,
  });

  // Pre-populate form when existing negotiation data loads
  useEffect(() => {
    console.log('Edit mode:', isEditMode, 'Existing negotiation data:', existingNegotiation);
    if (existingNegotiation && isEditMode) {
      console.log('Populating form with existing data:', existingNegotiation);
      setConfig({
        title: existingNegotiation.title || "",
        userRole: existingNegotiation.userRole || "",
        negotiationType: existingNegotiation.negotiationType || "",
        relationshipType: existingNegotiation.relationshipType || "",
        productMarketDescription: existingNegotiation.productMarketDescription || "",
        additionalComments: existingNegotiation.additionalComments || "",
        dimensions: existingNegotiation.dimensions || [],
        selectedTechniques: existingNegotiation.selectedTechniques || [],
        selectedTactics: existingNegotiation.selectedTactics || [],
        counterpartPersonality: existingNegotiation.counterpartPersonality || "",
        zopaDistance: existingNegotiation.zopaDistance || ""
      });
    }
  }, [existingNegotiation, isEditMode]);

  const updateConfig = (updates: Partial<NegotiationConfig>) => {
    setConfig(prev => ({ ...prev, ...updates }));
  };

  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Basic Context
        return !!(
          config.title.trim() &&
          config.userRole &&
          config.negotiationType &&
          config.relationshipType
        );
      case 1: // Dimensions
        return config.dimensions.length > 0 && 
          config.dimensions.every(d => 
            d.name.trim() && 
            d.minValue < d.targetValue && 
            d.targetValue < d.maxValue
          );
      case 2: // Techniques
        return config.selectedTechniques.length > 0;
      case 3: // Tactics
        return config.selectedTactics.length > 0;
      case 4: // Counterpart - no validation needed, fields are optional
        return true;
      default:
        return true;
    }
  };

  const canProceed = validateStep(currentStep);

  const handleComplete = async () => {
    setIsCompleting(true);
    
    try {
      if (isEditMode) {
        // Update existing negotiation
        console.log("Updating negotiation with config:", config);
        
        const response = await fetch(`/api/negotiations/${editId}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          let errorMessage = "Failed to update negotiation";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error("API Error:", errorData);
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        
        toast({
          title: "Negotiation Updated",
          description: `"${config.title}" has been updated successfully.`,
        });
      } else {
        // Create new negotiation
        console.log("Creating negotiation with config:", config);
        
        const response = await fetch("/api/negotiations/enhanced", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(config),
        });

        if (!response.ok) {
          let errorMessage = "Failed to create negotiation";
          try {
            const errorData = await response.json();
            errorMessage = errorData.error || errorMessage;
            console.error("API Error:", errorData);
          } catch (parseError) {
            console.error("Failed to parse error response:", parseError);
            errorMessage = `HTTP ${response.status}: ${response.statusText}`;
          }
          throw new Error(errorMessage);
        }

        const result = await response.json();
        
        toast({
          title: "Negotiation Created",
          description: `"${config.title}" has been created successfully with ${result.dimensionsCount} dimensions.`,
        });
      }
      
      // Redirect to negotiations list
      setLocation("/negotiations");
      
    } catch (error) {
      console.error(isEditMode ? "Error updating negotiation:" : "Error creating negotiation:", error);
      toast({
        title: isEditMode ? "Update Failed" : "Creation Failed",
        description: error instanceof Error ? error.message : `There was an error ${isEditMode ? 'updating' : 'creating'} the negotiation. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const steps: WizardStep[] = [
    {
      id: "context",
      title: "Basic Context",
      description: "Define the fundamental parameters of your negotiation",
      component: (
        <BasicContextStep 
          config={config} 
          onChange={updateConfig}
        />
      )
    },
    {
      id: "dimensions",
      title: "Dimensions & ZOPA",
      description: "Set up the negotiation parameters and your Zone of Possible Agreement",
      component: (
        <DimensionsStep 
          config={config} 
          onChange={updateConfig}
        />
      )
    },
    {
      id: "techniques",
      title: "Influencing Techniques",
      description: "Choose psychological techniques to influence the negotiation",
      component: (
        <TechniquesStep 
          config={config} 
          onChange={updateConfig}
        />
      )
    },
    {
      id: "tactics",
      title: "Negotiation Tactics",
      description: "Select strategic approaches for the negotiation",
      component: (
        <TacticsStep 
          config={config} 
          onChange={updateConfig}
        />
      )
    },
    {
      id: "counterpart",
      title: "Counterpart Configuration",
      description: "Define your negotiation counterpart and simulation parameters",
      component: (
        <CounterpartStep 
          config={config} 
          onChange={updateConfig}
        />
      )
    }
  ];

  // Show loading state while loading existing negotiation data
  if (isEditMode && isLoadingExisting) {
    return (
      <div className="space-y-8">
        <div className="text-center">
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Loading Configuration...</h1>
          <p className="text-gray-600 mt-2">Please wait while we load the negotiation data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {isEditMode ? "Edit Negotiation Configuration" : "Configure Negotiation"}
        </h1>
        <p className="text-gray-600 mt-2">
          {isEditMode ? "Update your negotiation parameters" : "Setup your negotiation parameters step by step"}
        </p>
      </div>

      <WizardForm
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onComplete={handleComplete}
        canProceed={canProceed}
        isCompleting={isCompleting}
        completionText={isEditMode ? "Update Configuration" : "Create Negotiation"}
      />
    </div>
  );
}
