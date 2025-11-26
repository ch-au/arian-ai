import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Minus, AlertCircle, Search, Grid, Users, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NegotiationConfig {
  title: string;
  userRole: "buyer" | "seller" | "";
  negotiationType: "one-shot" | "multi-year" | "";
  relationshipType: "first" | "long-standing" | "";
  productMarketDescription: string;
  additionalComments: string;
  dimensions: DimensionConfig[];
  selectedTechniques: string[];
  selectedTactics: string[];
  counterpartPersonality: string;
  zopaDistance: "close" | "medium" | "far" | "all-distances" | "";
}

export interface DimensionConfig {
  id: string;
  name: string;
  minValue: number;
  maxValue: number;
  targetValue: number;
  priority: 1 | 2 | 3;
  unit?: string;
}

export interface InfluencingTechnique {
  id: string;
  name: string;
  beschreibung: string;
  anwendung: string;
  wichtigeAspekte: string[];
  keyPhrases: string[];
  createdAt: string;
}

export interface NegotiationTactic {
  id: string;
  name: string;
  beschreibung: string;
  anwendung: string;
  wichtigeAspekte: string[];
  keyPhrases: string[];
  createdAt: string;
}

interface BasicContextStepProps {
  config: NegotiationConfig;
  onChange: (config: Partial<NegotiationConfig>) => void;
}

export function BasicContextStep({ config, onChange }: BasicContextStepProps) {
  return (
    <div className="space-y-6">
      {/* Title */}
      <div className="space-y-2">
        <Label htmlFor="title" className="text-base font-medium">
          Negotiation Title *
        </Label>
        <Input
          id="title"
          placeholder="e.g., Enterprise Software License Agreement"
          value={config.title}
          onChange={(e) => onChange({ title: e.target.value })}
          className="text-lg"
        />
        <p className="text-sm text-gray-600">
          Give your negotiation a descriptive name for easy identification
        </p>
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <Label className="text-base font-medium">Your Role *</Label>
        <div className="flex gap-3">
          <Button
            type="button"
            variant={config.userRole === "buyer" ? "default" : "outline"}
            onClick={() => onChange({ userRole: "buyer" })}
            className="flex-1"
          >
            🛒 Buyer
          </Button>
          <Button
            type="button"
            variant={config.userRole === "seller" ? "default" : "outline"}
            onClick={() => onChange({ userRole: "seller" })}
            className="flex-1"
          >
            🏢 Seller
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Negotiation Type */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Negotiation Type *</Label>
          <Select
            value={config.negotiationType}
            onValueChange={(value: "one-shot" | "multi-year") => onChange({ negotiationType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="one-shot">
                <div className="flex flex-col items-start">
                  <span>One-shot</span>
                  <span className="text-xs text-gray-500">Single transaction</span>
                </div>
              </SelectItem>
              <SelectItem value="multi-year">
                <div className="flex flex-col items-start">
                  <span>Multi-year</span>
                  <span className="text-xs text-gray-500">Long-term contract</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Relationship Type */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Existing Relationship *</Label>
          <Select
            value={config.relationshipType}
            onValueChange={(value: "first" | "long-standing") => onChange({ relationshipType: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select relationship" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first">
                <div className="flex flex-col items-start">
                  <span>First-time</span>
                  <span className="text-xs text-gray-500">New business relationship</span>
                </div>
              </SelectItem>
              <SelectItem value="long-standing">
                <div className="flex flex-col items-start">
                  <span>Long-standing</span>
                  <span className="text-xs text-gray-500">Established partnership</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Product/Market Description */}
      <div className="space-y-2">
        <Label htmlFor="product" className="text-base font-medium">
          Product & Market Context
        </Label>
        <Textarea
          id="product"
          placeholder="Describe the products, services, or markets relevant to this negotiation..."
          value={config.productMarketDescription}
          onChange={(e) => onChange({ productMarketDescription: e.target.value })}
          rows={4}
        />
      </div>

      {/* Additional Comments */}
      <div className="space-y-2">
        <Label htmlFor="comments" className="text-base font-medium">
          Additional Comments
        </Label>
        <Textarea
          id="comments"
          placeholder="Any specific requirements, constraints, or notes for this negotiation..."
          value={config.additionalComments}
          onChange={(e) => onChange({ additionalComments: e.target.value })}
          rows={3}
        />
      </div>
    </div>
  );
}

interface DimensionsStepProps {
  config: NegotiationConfig;
  onChange: (config: Partial<NegotiationConfig>) => void;
}

export function DimensionsStep({ config, onChange }: DimensionsStepProps) {
  const addDimension = () => {
    const newDimension: DimensionConfig = {
      id: Date.now().toString(),
      name: "",
      minValue: 0,
      maxValue: 100,
      targetValue: 50,
      priority: 2,
      unit: ""
    };
    
    onChange({
      dimensions: [...config.dimensions, newDimension]
    });
  };

  const removeDimension = (id: string) => {
    onChange({
      dimensions: config.dimensions.filter(d => d.id !== id)
    });
  };

  const updateDimension = (id: string, updates: Partial<DimensionConfig>) => {
    onChange({
      dimensions: config.dimensions.map(d => 
        d.id === id ? { ...d, ...updates } : d
      )
    });
  };

  const addDefaultDimensions = () => {
    const defaultDimensions: DimensionConfig[] = [
      { id: "1", name: "Price", minValue: 50000, maxValue: 150000, targetValue: 100000, priority: 1, unit: "USD" },
      { id: "2", name: "Volume", minValue: 100, maxValue: 1000, targetValue: 500, priority: 2, unit: "units" },
      { id: "3", name: "Payment Terms", minValue: 30, maxValue: 90, targetValue: 60, priority: 2, unit: "days" },
      { id: "4", name: "Contract Duration", minValue: 12, maxValue: 60, targetValue: 36, priority: 3, unit: "months" }
    ];
    
    onChange({ dimensions: defaultDimensions });
  };

  const getPriorityLabel = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1: return "Must have";
      case 2: return "Important";
      case 3: return "Flexible";
    }
  };

  const getPriorityColor = (priority: 1 | 2 | 3) => {
    switch (priority) {
      case 1: return "bg-red-100 text-red-800";
      case 2: return "bg-yellow-100 text-yellow-800";
      case 3: return "bg-green-100 text-green-800";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Negotiation Dimensions</h3>
          <p className="text-gray-600">Define the key parameters and your ZOPA (Zone of Possible Agreement)</p>
        </div>
        {config.dimensions.length === 0 && (
          <Button onClick={addDefaultDimensions} variant="outline" size="sm">
            Add Default Dimensions
          </Button>
        )}
      </div>

      {config.dimensions.length === 0 ? (
        <Card className="border-dashed border-2 border-gray-200">
          <CardContent className="text-center py-12">
            <div className="w-12 h-12 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
              <Plus className="w-6 h-6 text-gray-600" />
            </div>
            <h4 className="text-lg font-semibold mb-2">No dimensions yet</h4>
            <p className="text-gray-600 mb-4">Add dimensions to define what you'll be negotiating about</p>
            <Button onClick={addDimension}>Add First Dimension</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {config.dimensions.map((dimension, index) => (
            <Card key={dimension.id} className="p-4">
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium">Dimension Name *</Label>
                      <Input
                        placeholder="e.g., Price, Volume, Duration"
                        value={dimension.name}
                        onChange={(e) => updateDimension(dimension.id, { name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label className="text-sm font-medium">Unit</Label>
                      <Input
                        placeholder="e.g., USD, units, days"
                        value={dimension.unit || ""}
                        onChange={(e) => updateDimension(dimension.id, { unit: e.target.value })}
                      />
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeDimension(dimension.id)}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <Minus className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Min Value *</Label>
                    <Input
                      type="number"
                      value={dimension.minValue}
                      onChange={(e) => updateDimension(dimension.id, { minValue: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Target Value *</Label>
                    <Input
                      type="number"
                      value={dimension.targetValue}
                      onChange={(e) => updateDimension(dimension.id, { targetValue: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Max Value *</Label>
                    <Input
                      type="number"
                      value={dimension.maxValue}
                      onChange={(e) => updateDimension(dimension.id, { maxValue: Number(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Priority *</Label>
                    <Select
                      value={dimension.priority.toString()}
                      onValueChange={(value) => updateDimension(dimension.id, { priority: Number(value) as 1 | 2 | 3 })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">1 - Must have</SelectItem>
                        <SelectItem value="2">2 - Important</SelectItem>
                        <SelectItem value="3">3 - Flexible</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <Badge className={getPriorityColor(dimension.priority)}>
                    {getPriorityLabel(dimension.priority)}
                  </Badge>
                  {dimension.minValue >= dimension.targetValue || dimension.targetValue >= dimension.maxValue ? (
                    <div className="flex items-center gap-1 text-red-600 text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>Min &lt; Target &lt; Max required</span>
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          ))}

          <Button onClick={addDimension} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Another Dimension
          </Button>
        </div>
      )}
    </div>
  );
}

interface TechniquesStepProps {
  config: NegotiationConfig;
  onChange: (config: Partial<NegotiationConfig>) => void;
}

export function TechniquesStep({ config, onChange }: TechniquesStepProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: techniques = [], isLoading } = useQuery<InfluencingTechnique[]>({
    queryKey: ["/api/influencing-techniques"],
  });

  const filteredTechniques = techniques.filter(technique =>
    technique.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    technique.beschreibung.toLowerCase().includes(searchQuery.toLowerCase()) ||
    technique.anwendung.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTechnique = (techniqueId: string) => {
    const isSelected = config.selectedTechniques.includes(techniqueId);
    const newSelection = isSelected
      ? config.selectedTechniques.filter(id => id !== techniqueId)
      : [...config.selectedTechniques, techniqueId];
    
    onChange({ selectedTechniques: newSelection });
  };

  const selectAll = () => {
    onChange({ selectedTechniques: techniques.map(t => t.id) });
  };

  const selectNone = () => {
    onChange({ selectedTechniques: [] });
  };

  // Since there's no category field, we'll display all techniques in a single grid

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Brain className="w-5 h-5" />
            Influencing Techniques
          </h3>
          <p className="text-gray-600">Choose psychological techniques to influence the negotiation</p>
        </div>
        <div className="text-sm text-gray-500">
          {config.selectedTechniques.length} of {techniques.length} selected
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search techniques..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={selectAll} variant="outline" size="sm">
            Select All
          </Button>
          <Button onClick={selectNone} variant="outline" size="sm">
            Select None
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTechniques.map((technique) => {
          const isSelected = config.selectedTechniques.includes(technique.id);
          return (
            <Card
              key={technique.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-gray-50"
              )}
              onClick={() => toggleTechnique(technique.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-1"
                  />
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">{technique.name}</h5>
                <p className="text-sm text-gray-600 line-clamp-3">{technique.beschreibung}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTechniques.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <Grid className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">No techniques found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}

interface TacticsStepProps {
  config: NegotiationConfig;
  onChange: (config: Partial<NegotiationConfig>) => void;
}

export function TacticsStep({ config, onChange }: TacticsStepProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const { data: tactics = [], isLoading } = useQuery<NegotiationTactic[]>({
    queryKey: ["/api/negotiation-tactics"],
  });

  const filteredTactics = tactics.filter(tactic =>
    tactic.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tactic.beschreibung.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tactic.anwendung.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const toggleTactic = (tacticId: string) => {
    const isSelected = config.selectedTactics.includes(tacticId);
    const newSelection = isSelected
      ? config.selectedTactics.filter(id => id !== tacticId)
      : [...config.selectedTactics, tacticId];
    
    onChange({ selectedTactics: newSelection });
  };

  const selectAll = () => {
    onChange({ selectedTactics: tactics.map(t => t.id) });
  };

  const selectNone = () => {
    onChange({ selectedTactics: [] });
  };

  // Since there's no category field, we'll display all tactics in a single grid

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded mb-4"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Grid className="w-5 h-5" />
            Negotiation Tactics
          </h3>
          <p className="text-gray-600">Select strategic approaches for the negotiation</p>
        </div>
        <div className="text-sm text-gray-500">
          {config.selectedTactics.length} of {tactics.length} selected
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Search tactics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex gap-2">
          <Button onClick={selectAll} variant="outline" size="sm">
            Select All
          </Button>
          <Button onClick={selectNone} variant="outline" size="sm">
            Select None
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredTactics.map((tactic) => {
          const isSelected = config.selectedTactics.includes(tactic.id);
          return (
            <Card
              key={tactic.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md",
                isSelected ? "ring-2 ring-primary bg-primary/5" : "hover:bg-gray-50"
              )}
              onClick={() => toggleTactic(tactic.id)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <Checkbox
                    checked={isSelected}
                    onChange={() => {}}
                    className="mt-1"
                  />
                </div>
                <h5 className="font-semibold text-gray-900 mb-2">{tactic.name}</h5>
                <p className="text-sm text-gray-600 line-clamp-3">{tactic.beschreibung}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredTactics.length === 0 && searchQuery && (
        <div className="text-center py-8">
          <Grid className="w-12 h-12 mx-auto mb-4 text-gray-400" />
          <p className="text-gray-500">No tactics found matching "{searchQuery}"</p>
        </div>
      )}
    </div>
  );
}

interface CounterpartStepProps {
  config: NegotiationConfig;
  onChange: (config: Partial<NegotiationConfig>) => void;
}

export function CounterpartStep({ config, onChange }: CounterpartStepProps) {
  const { data: personalities = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/personality-types"],
  });

  // Calculate simulation count including personality multiplier
  // Note: Distance is now modeled explicitly via counterpartDistance, so we skip distance variations
  const personalityCount = (config.counterpartPersonality && config.counterpartPersonality !== "all-personalities") ? 1 : personalities.length || 5;
  const simulationCount = config.selectedTechniques.length * config.selectedTactics.length * personalityCount;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Users className="w-5 h-5" />
          Counterpart Configuration
        </h3>
        <p className="text-gray-600">Define your negotiation counterpart and simulation parameters</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Personality Selection */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Counterpart Personality (Optional)</Label>
          <Select
            value={config.counterpartPersonality}
            onValueChange={(value) => onChange({ counterpartPersonality: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All personalities (or select specific)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-personalities">
                <div className="flex flex-col items-start">
                  <span className="font-medium">All Personalities</span>
                  <span className="text-xs text-gray-500">Test against all personality types</span>
                </div>
              </SelectItem>
              {isLoading ? (
                <SelectItem value="loading" disabled>
                  Loading personalities...
                </SelectItem>
              ) : (
                personalities.map((personality: any) => (
                  <SelectItem key={personality.id} value={personality.id}>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{personality.name}</span>
                      <span className="text-xs text-gray-500">{personality.description}</span>
                    </div>
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-600">
            Leave empty to test against all personality types, or select a specific one
          </p>
        </div>

        {/* ZOPA Distance */}
        <div className="space-y-2">
          <Label className="text-base font-medium">ZOPA Distance (Optional)</Label>
          <Select
            value={config.zopaDistance}
            onValueChange={(value: "close" | "medium" | "far" | "") => onChange({ zopaDistance: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder="All distances (or select specific)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all-distances">
                <div className="flex flex-col items-start">
                  <span className="font-medium">All Distances</span>
                  <span className="text-xs text-gray-500">Test all ZOPA distance scenarios</span>
                </div>
              </SelectItem>
              <SelectItem value="close">
                <div className="flex flex-col items-start">
                  <span>Close</span>
                  <span className="text-xs text-gray-500">Overlapping zones, easy agreement</span>
                </div>
              </SelectItem>
              <SelectItem value="medium">
                <div className="flex flex-col items-start">
                  <span>Medium</span>
                  <span className="text-xs text-gray-500">Some overlap, moderate negotiation</span>
                </div>
              </SelectItem>
              <SelectItem value="far">
                <div className="flex flex-col items-start">
                  <span>Far</span>
                  <span className="text-xs text-gray-500">Little/no overlap, challenging negotiation</span>
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-gray-600">
            Leave empty to test all ZOPA distances, or select a specific distance
          </p>
        </div>
      </div>

      {/* Simulation Preview */}
      <Card className={`${simulationCount > 1000 ? "bg-orange-50 border-orange-200" : "bg-blue-50 border-blue-200"}`}>
        <CardHeader className="pb-3">
          <CardTitle className={`text-lg ${simulationCount > 1000 ? "text-orange-900" : "text-blue-900"}`}>
            Simulation Preview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className={simulationCount > 1000 ? "text-orange-800" : "text-blue-800"}>Total simulation runs:</span>
              <Badge className={`${simulationCount > 1000 ? "bg-orange-100 text-orange-800" : "bg-blue-100 text-blue-800"}`}>
                {simulationCount.toLocaleString()} runs
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className={simulationCount > 1000 ? "text-orange-800" : "text-blue-800"}>Techniques selected:</span>
              <span className={`font-medium ${simulationCount > 1000 ? "text-orange-900" : "text-blue-900"}`}>{config.selectedTechniques.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={simulationCount > 1000 ? "text-orange-800" : "text-blue-800"}>Tactics selected:</span>
              <span className={`font-medium ${simulationCount > 1000 ? "text-orange-900" : "text-blue-900"}`}>{config.selectedTactics.length}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className={simulationCount > 1000 ? "text-orange-800" : "text-blue-800"}>Personality types:</span>
              <span className={`font-medium ${simulationCount > 1000 ? "text-orange-900" : "text-blue-900"}`}>
                {(config.counterpartPersonality && config.counterpartPersonality !== "all-personalities") ? "1 specific" : `All ${personalityCount}`}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={simulationCount > 1000 ? "text-orange-800" : "text-blue-800"}>ZOPA distances:</span>
              <span className={`font-medium ${simulationCount > 1000 ? "text-orange-900" : "text-blue-900"}`}>
                {config.zopaDistance ? "1 specific" : "All 3"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className={simulationCount > 1000 ? "text-orange-800" : "text-blue-800"}>Dimensions to negotiate:</span>
              <span className={`font-medium ${simulationCount > 1000 ? "text-orange-900" : "text-blue-900"}`}>{config.dimensions.length}</span>
            </div>
            
            {simulationCount > 1000 && (
              <div className="mt-4 p-4 bg-orange-100 border border-orange-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <div className="text-orange-600 mt-0.5">⚠️</div>
                  <div>
                    <p className="text-sm font-medium text-orange-800 mb-1">High Simulation Count Warning</p>
                    <p className="text-sm text-orange-700">
                      This configuration will generate {simulationCount.toLocaleString()} simulation runs, which may take considerable time and resources. 
                      Consider selecting fewer techniques/tactics or choosing specific personality types and ZOPA distances to reduce the count.
                    </p>
                  </div>
                </div>
              </div>
            )}
            
            {simulationCount > 0 && simulationCount <= 1000 && (
              <div className="mt-4 p-3 bg-blue-100 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>Combinatorial Testing:</strong> Each technique will be paired with each tactic across {personalityCount} personality type(s),
                  creating {simulationCount.toLocaleString()} unique simulation runs for comprehensive analysis.
                </p>
              </div>
            )}
            
            {simulationCount === 0 && (
              <div className="mt-4 p-3 bg-yellow-100 border border-yellow-200 rounded-lg">
                <p className="text-sm text-yellow-800">
                  ⚠️ Please select at least one technique and one tactic to run simulations.
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
