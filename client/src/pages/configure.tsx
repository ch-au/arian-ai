import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { WizardForm, WizardStep } from "@/components/wizard-form";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "react-i18next";

// Phase 2 Components
import { GrundeinstellungenStep, GrundeinstellungenData } from "@/components/configure/GrundeinstellungenStep";
import { DimensionenStep, DimensionenData } from "@/components/configure/DimensionenStep";
import { TaktikenTechnikenStep, TaktikenTechnikenData } from "@/components/configure/TaktikenTechnikenStep";
import { GegenseiteStep, GegenseiteData } from "@/components/configure/GegenseiteStep";
import { ReviewStep, MarketIntelligenceItem } from "@/components/configure/ReviewStep";

// Phase 2 Combined Configuration
interface Phase2Config {
  grundeinstellungen: GrundeinstellungenData;
  dimensionen: DimensionenData;
  taktikenTechniken: TaktikenTechnikenData;
  gegenseite: GegenseiteData;
  marketIntelligence: MarketIntelligenceItem[];
}

const initialConfig: Phase2Config = {
  grundeinstellungen: {
    title: "",
    userRole: "buyer",
    negotiationType: "one-shot",
    companyKnown: false,
    counterpartKnown: false,
    negotiationFrequency: "yearly",
    powerBalance: 50,
    maxRounds: 5,
    marktProduktKontext: "",
    wichtigerKontext: "",
  },
  dimensionen: {
    produkte: [],
    konditionen: [],
  },
  taktikenTechniken: {
    selectedTacticIds: [],
    selectedTechniqueIds: [],
  },
  gegenseite: {
    beschreibungGegenseite: "",
    verhandlungsModus: "moderat",
    geschätzteDistanz: {}, // Dynamic based on products/conditions
  },
  marketIntelligence: [],
};

export default function Configure() {
  const [location, setLocation] = useLocation();
  const [currentStep, setCurrentStep] = useState(0);
  const [config, setConfig] = useState<Phase2Config>(initialConfig);
  const [isCompleting, setIsCompleting] = useState(false);
  const [isLoadingIntelligence, setIsLoadingIntelligence] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation('configure');
  
  // Load tactics and techniques
  const { data: tactics = [] } = useQuery<any[]>({
    queryKey: ['/api/negotiation-tactics'],
  });

  const { data: techniques = [] } = useQuery<any[]>({
    queryKey: ['/api/influencing-techniques'],
  });

  const updateGrundeinstellungen = (updates: Partial<GrundeinstellungenData>) => {
    setConfig(prev => ({
      ...prev,
      grundeinstellungen: { ...prev.grundeinstellungen, ...updates },
    }));
  };

  const updateDimensionen = (updates: Partial<DimensionenData>) => {
    setConfig(prev => ({
      ...prev,
      dimensionen: { ...prev.dimensionen, ...updates },
    }));
  };

  const updateTaktikenTechniken = (updates: Partial<TaktikenTechnikenData>) => {
    setConfig(prev => ({
      ...prev,
      taktikenTechniken: { ...prev.taktikenTechniken, ...updates },
    }));
  };

  const updateGegenseite = (updates: Partial<GegenseiteData>) => {
    setConfig(prev => ({
      ...prev,
      gegenseite: { ...prev.gegenseite, ...updates },
    }));
  };

  const handleGenerateIntelligence = async () => {
    // Validate required fields
    if (!config.grundeinstellungen.title || !config.grundeinstellungen.title.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Verhandlungstitel ein",
        variant: "destructive",
      });
      return;
    }
    
    if (!config.grundeinstellungen.marktProduktKontext || !config.grundeinstellungen.marktProduktKontext.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Markt- und Produktkontext ein",
        variant: "destructive",
      });
      return;
    }
    
    setIsLoadingIntelligence(true);
    try {
      const response = await fetch('/api/market-intelligence', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: config.grundeinstellungen.title,
          marktProduktKontext: config.grundeinstellungen.marktProduktKontext,
          userRole: config.grundeinstellungen.userRole,
          produkte: config.dimensionen.produkte,
        }),
      });

      // Check if response is JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Non-JSON response:', text.substring(0, 200));
        throw new Error(`Server returned HTML instead of JSON. Status: ${response.status}`);
      }

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || error.error || `API Fehler: ${response.status}`);
      }

      const data = await response.json();

      setConfig(prev => ({
        ...prev,
        marketIntelligence: data.intelligence || [],
      }));

      toast({
        title: "Marktanalyse erstellt",
        description: `${data.intelligence?.length || 0} Aspekte gefunden`,
      });
    } catch (error: any) {
      console.error('Market Intelligence Error:', error);
      toast({
        title: "Fehler",
        description: error.message || "Marktanalyse konnte nicht generiert werden",
        variant: "destructive",
      });
    } finally {
      setIsLoadingIntelligence(false);
    }
  };

  const validateStep = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0: // Grundeinstellungen
        return !!(
          config.grundeinstellungen.title.trim() &&
          config.grundeinstellungen.userRole &&
          config.grundeinstellungen.negotiationType
        );
      case 1: // Dimensionen
        return config.dimensionen.produkte.length > 0 || config.dimensionen.konditionen.length > 0;
      case 2: // Taktiken & Techniken
        return (
          config.taktikenTechniken.selectedTacticIds.length > 0 &&
          config.taktikenTechniken.selectedTechniqueIds.length > 0
        );
      case 3: // Gegenseite - optional
        return true;
      case 4: // Review - always valid
        return true;
      default:
        return true;
    }
  };

  const canProceed = validateStep(currentStep);

  const handleComplete = async () => {
    setIsCompleting(true);

    try {
      // Map Phase 2 config to backend API format
      const apiPayload = {
        // Grundeinstellungen
        title: config.grundeinstellungen.title,
        userRole: config.grundeinstellungen.userRole,
        negotiationType: config.grundeinstellungen.negotiationType,
        companyKnown: config.grundeinstellungen.companyKnown,
        counterpartKnown: config.grundeinstellungen.counterpartKnown,
        negotiationFrequency: config.grundeinstellungen.negotiationFrequency,
        powerBalance: config.grundeinstellungen.powerBalance,
        maxRounds: config.grundeinstellungen.maxRounds,
        marktProduktKontext: config.grundeinstellungen.marktProduktKontext,
        wichtigerKontext: config.grundeinstellungen.wichtigerKontext,

        // Dimensionen
        produkte: config.dimensionen.produkte,
        konditionen: config.dimensionen.konditionen,

        // Taktiken & Techniken
        selectedTacticIds: config.taktikenTechniken.selectedTacticIds,
        selectedTechniqueIds: config.taktikenTechniken.selectedTechniqueIds,

        // Gegenseite
        beschreibungGegenseite: config.gegenseite.beschreibungGegenseite,
        verhandlungsModus: config.gegenseite.verhandlungsModus,
        geschätzteDistanz: config.gegenseite.geschätzteDistanz,

        // Market Intelligence
        marketIntelligence: config.marketIntelligence,
      };

      console.log("Creating Phase 2 negotiation:", apiPayload);

      const response = await fetch("/api/negotiations/phase2", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(apiPayload),
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
        title: "Verhandlung erstellt",
        description: `"${config.grundeinstellungen.title}" wurde erfolgreich erstellt.`,
      });

      // Redirect to dashboard
      setLocation("/");
    } catch (error) {
      console.error("Error creating negotiation:", error);
      toast({
        title: "Fehler",
        description:
          error instanceof Error
            ? error.message
            : "Es gab einen Fehler beim Erstellen der Verhandlung.",
        variant: "destructive",
      });
    } finally {
      setIsCompleting(false);
    }
  };

  const steps: WizardStep[] = [
    {
      id: "grundeinstellungen",
      title: t('steps.grundeinstellungen'),
      description: "Grundlegende Verhandlungsparameter festlegen",
      component: (
        <GrundeinstellungenStep
          data={config.grundeinstellungen}
          onChange={updateGrundeinstellungen}
        />
      ),
    },
    {
      id: "dimensionen",
      title: t('steps.dimensionen'),
      description: "Produkte und Konditionen definieren",
      component: (
        <DimensionenStep
          data={config.dimensionen}
          onChange={updateDimensionen}
          userRole={config.grundeinstellungen.userRole}
        />
      ),
    },
    {
      id: "taktiken",
      title: t('steps.taktiken'),
      description: "Taktiken und Techniken auswählen",
      component: (
        <TaktikenTechnikenStep
          data={config.taktikenTechniken}
          onChange={updateTaktikenTechniken}
          availableTactics={tactics}
          availableTechniques={techniques}
        />
      ),
    },
    {
      id: "gegenseite",
      title: t('steps.gegenseite'),
      description: "Verhandlungspartner beschreiben",
      component: (
        <GegenseiteStep
          data={config.gegenseite}
          onChange={updateGegenseite}
          produkte={config.dimensionen.produkte}
          konditionen={config.dimensionen.konditionen}
        />
      ),
    },
    {
      id: "review",
      title: t('steps.review'),
      description: "Überprüfen und starten",
      component: (
        <ReviewStep
          negotiationTitle={config.grundeinstellungen.title}
          userRole={config.grundeinstellungen.userRole}
          negotiationType={config.grundeinstellungen.negotiationType}
          productCount={config.dimensionen.produkte.length}
          conditionCount={config.dimensionen.konditionen.length}
          tacticCount={config.taktikenTechniken.selectedTacticIds.length}
          techniqueCount={config.taktikenTechniken.selectedTechniqueIds.length}
          verhandlungsModus={config.gegenseite.verhandlungsModus}
          onGenerateIntelligence={handleGenerateIntelligence}
          marketIntelligence={config.marketIntelligence}
          isLoadingIntelligence={isLoadingIntelligence}
        />
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight text-gray-900">
          {t('title')}
        </h1>
        <p className="text-gray-600 mt-2">
          Konfigurieren Sie Ihre Verhandlung Schritt für Schritt
        </p>
      </div>

      <WizardForm
        steps={steps}
        currentStep={currentStep}
        onStepChange={setCurrentStep}
        onComplete={handleComplete}
        canProceed={canProceed}
        isCompleting={isCompleting}
        completionText="Simulation starten"
      />
    </div>
  );
}
