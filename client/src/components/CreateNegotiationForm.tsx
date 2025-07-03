import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Settings, Users, Target, Play, ArrowLeft, ArrowRight, Brain, Zap } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const zopaDimensionSchema = z.object({
  min: z.number(),
  max: z.number(),
  target: z.number(),
});

const createNegotiationSchema = z.object({
  contextId: z.string().min(1, "Please select a negotiation context"),
  buyerAgentId: z.string().min(1, "Please select a buyer agent"),
  sellerAgentId: z.string().min(1, "Please select a seller agent"),
  maxRounds: z.number().min(1).max(50),
  selectedTechniques: z.array(z.string()).min(1, "Select at least one influencing technique"),
  selectedTactics: z.array(z.string()).min(1, "Select at least one negotiation tactic"),
  // Role and ZOPA configuration (consolidated)
  userRole: z.enum(["buyer", "seller"]),
  userZopa: z.object({
    volumen: zopaDimensionSchema,
    preis: zopaDimensionSchema,
    laufzeit: zopaDimensionSchema,
    zahlungskonditionen: zopaDimensionSchema,
  }),
  // Counterpart distance settings (consolidated)
  counterpartDistance: z.object({
    volumen: z.number().min(-1).max(1).default(0),
    preis: z.number().min(-1).max(1).default(0),
    laufzeit: z.number().min(-1).max(1).default(0),
    zahlungskonditionen: z.number().min(-1).max(1).default(0),
  }),
  sonderinteressen: z.string().optional(),
  autoStart: z.boolean().default(false),
});

type CreateNegotiationForm = z.infer<typeof createNegotiationSchema>;

interface Props {
  agents: any[];
  contexts: any[];
  onSuccess: () => void;
}

// Sample data for techniques and tactics (will be replaced with API data)
const sampleTechniques = [
  { id: "scarcity", name: "Scarcity Technique", description: "Creates urgency by emphasizing limited availability" },
  { id: "social_proof", name: "Social Proof", description: "Use examples of others to influence decisions" },
  { id: "reciprocity", name: "Reciprocity", description: "Create obligation through giving first" },
  { id: "authority", name: "Authority", description: "Leverage expertise and credibility" },
  { id: "commitment", name: "Commitment & Consistency", description: "Build on previous commitments" },
  { id: "liking", name: "Liking", description: "Build rapport and connection" },
];

const sampleTactics = [
  { id: "competitive_pricing", name: "Competitive Pricing", description: "Focus on price-based negotiations" },
  { id: "value_creation", name: "Value Creation", description: "Look for win-win opportunities" },
  { id: "time_pressure", name: "Time Pressure", description: "Use urgency to drive decisions" },
  { id: "relationship_building", name: "Relationship Building", description: "Focus on long-term partnerships" },
  { id: "anchoring", name: "Anchoring", description: "Set initial reference points" },
  { id: "concession_strategy", name: "Concession Strategy", description: "Strategic give-and-take approach" },
];

export default function CreateNegotiationForm({ agents, contexts, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const form = useForm<CreateNegotiationForm>({
    resolver: zodResolver(createNegotiationSchema),
    defaultValues: {
      maxRounds: 10,
      selectedTechniques: [],
      selectedTactics: [],
      userRole: "buyer",
      userZopa: {
        volumen: { min: 100, max: 1000, target: 500 },
        preis: { min: 10, max: 100, target: 50 },
        laufzeit: { min: 12, max: 36, target: 24 },
        zahlungskonditionen: { min: 30, max: 90, target: 60 },
      },
      counterpartDistance: {
        volumen: 0,
        preis: 0,
        laufzeit: 0,
        zahlungskonditionen: 0,
      },
      sonderinteressen: "",
      autoStart: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateNegotiationForm) => {
      console.log("Form data before sending:", data);
      
      const payload = {
        contextId: data.contextId,
        buyerAgentId: data.buyerAgentId,
        sellerAgentId: data.sellerAgentId,
        maxRounds: data.maxRounds,
        selectedTechniques: data.selectedTechniques,
        selectedTactics: data.selectedTactics,
        userRole: data.userRole,
        userZopa: data.userZopa,
        counterpartDistance: data.counterpartDistance,
        sonderinteressen: data.sonderinteressen || "",
      };
      
      console.log("Sending payload:", payload);
      
      const response = await apiRequest("POST", "/api/negotiations", payload);
      return response.json();
    },
    onSuccess: async (negotiation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      
      if (form.getValues().autoStart) {
        try {
          await apiRequest("POST", `/api/negotiations/${negotiation.id}/start`);
          toast({
            title: "Negotiation Created & Started",
            description: "Your negotiation simulation has been created and started successfully.",
          });
        } catch (error) {
          toast({
            title: "Negotiation Created",
            description: "Negotiation created but failed to auto-start. You can start it manually.",
            variant: "destructive",
          });
        }
      } else {
        toast({
          title: "Negotiation Created",
          description: "Your negotiation simulation has been created successfully.",
        });
      }
      
      onSuccess();
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create negotiation. Please try again.",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateNegotiationForm) => {
    createMutation.mutate(data);
  };

  const nextStep = () => {
    if (step < 5) setStep(step + 1);
  };

  const prevStep = () => {
    if (step > 1) setStep(step - 1);
  };

  const canProceedToStep2 = form.watch("contextId");
  const canProceedToStep3 = canProceedToStep2 && form.watch("buyerAgentId") && form.watch("sellerAgentId");
  const canProceedToStep4 = canProceedToStep3 && form.watch("selectedTechniques")?.length > 0 && form.watch("selectedTactics")?.length > 0;
  const canProceedToStep5 = canProceedToStep4 && form.watch("userRole");

  const stepTitles = [
    "Define Basic Parameters",
    "Select Agents", 
    "Choose Negotiation Style",
    "Configure ZOPA",
    "Review & Configure"
  ];

  const stepIcons = [Settings, Users, Brain, Target, Play];

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[1, 2, 3, 4, 5].map((stepNum) => {
          const StepIcon = stepIcons[stepNum - 1];
          return (
            <div key={stepNum} className="flex items-center">
              <div className="text-center">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium ${
                    step >= stepNum
                      ? "bg-blue-600 text-white"
                      : "bg-gray-200 text-gray-600"
                  }`}
                >
                  <StepIcon className="w-5 h-5" />
                </div>
                <p className="text-xs mt-2 text-gray-600">{stepTitles[stepNum - 1]}</p>
              </div>
              {stepNum < 5 && (
                <div
                  className={`w-16 h-1 mx-4 ${
                    step > stepNum ? "bg-blue-600" : "bg-gray-200"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Basic Parameters */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Define Basic Parameters
                </CardTitle>
                <CardDescription>
                  Choose the negotiation context and set basic parameters for your simulation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="contextId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Negotiation Context</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a negotiation context" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {contexts.map((context) => (
                            <SelectItem key={context.id} value={context.id}>
                              {context.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="maxRounds"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximum Rounds</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={1}
                          max={50}
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {form.watch("contextId") && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">Selected Context</h4>
                    <p className="text-blue-700 text-sm">
                      {contexts.find(c => c.id === form.watch("contextId"))?.description}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Step 2: Select Agents */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  Select Negotiation Agents
                </CardTitle>
                <CardDescription>
                  Choose the AI agents that will participate in the negotiation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="buyerAgentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Buyer Agent</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select buyer agent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="sellerAgentId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Seller Agent</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select seller agent" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {agents.map((agent) => (
                              <SelectItem key={agent.id} value={agent.id}>
                                {agent.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Show selected agents info */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {form.watch("buyerAgentId") && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-green-700 mb-2">Buyer Agent</h4>
                      <p className="text-sm">{agents.find(a => a.id === form.watch("buyerAgentId"))?.name}</p>
                      <Badge variant="secondary" className="mt-2">
                        Power: {agents.find(a => a.id === form.watch("buyerAgentId"))?.powerLevel}/10
                      </Badge>
                    </div>
                  )}

                  {form.watch("sellerAgentId") && (
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-blue-700 mb-2">Seller Agent</h4>
                      <p className="text-sm">{agents.find(a => a.id === form.watch("sellerAgentId"))?.name}</p>
                      <Badge variant="secondary" className="mt-2">
                        Power: {agents.find(a => a.id === form.watch("sellerAgentId"))?.powerLevel}/10
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Choose Negotiation Style */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Brain className="w-5 h-5 mr-2" />
                  Choose Negotiation Style
                </CardTitle>
                <CardDescription>
                  Select the influencing techniques and negotiation tactics to test in this simulation.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Influencing Techniques */}
                <div>
                  <FormField
                    control={form.control}
                    name="selectedTechniques"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Influencing Techniques</FormLabel>
                          <p className="text-sm text-gray-600">Select psychological techniques that agents should use</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {sampleTechniques.map((technique) => (
                            <FormField
                              key={technique.id}
                              control={form.control}
                              name="selectedTechniques"
                              render={({ field }) => (
                                <FormItem
                                  key={technique.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 border rounded-lg p-4"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(technique.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, technique.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== technique.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium">
                                      {technique.name}
                                    </FormLabel>
                                    <p className="text-xs text-gray-600">
                                      {technique.description}
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <Separator />

                {/* Negotiation Tactics */}
                <div>
                  <FormField
                    control={form.control}
                    name="selectedTactics"
                    render={() => (
                      <FormItem>
                        <div className="mb-4">
                          <FormLabel className="text-base">Negotiation Tactics</FormLabel>
                          <p className="text-sm text-gray-600">Select strategic approaches for the negotiation</p>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          {sampleTactics.map((tactic) => (
                            <FormField
                              key={tactic.id}
                              control={form.control}
                              name="selectedTactics"
                              render={({ field }) => (
                                <FormItem
                                  key={tactic.id}
                                  className="flex flex-row items-start space-x-3 space-y-0 border rounded-lg p-4"
                                >
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(tactic.id)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, tactic.id])
                                          : field.onChange(
                                              field.value?.filter(
                                                (value) => value !== tactic.id
                                              )
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <div className="space-y-1 leading-none">
                                    <FormLabel className="text-sm font-medium">
                                      {tactic.name}
                                    </FormLabel>
                                    <p className="text-xs text-gray-600">
                                      {tactic.description}
                                    </p>
                                  </div>
                                </FormItem>
                              )}
                            />
                          ))}
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 4: Configure ZOPA */}
          {step === 4 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Target className="w-5 h-5 mr-2" />
                  Configure ZOPA (Zone of Possible Agreement)
                </CardTitle>
                <CardDescription>
                  Set your negotiation ranges visually and compare with counterpart positions.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* User Role Selection */}
                <FormField
                  control={form.control}
                  name="userRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Your Role in Negotiation</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select your role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="buyer">Buyer (Käufer)</SelectItem>
                          <SelectItem value="seller">Seller (Verkäufer)</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Visual ZOPA Configuration */}
                <div className="space-y-8">
                  {/* Volumen */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Volumen (Volume)</h3>
                      <Badge variant="outline">Units/Stück</Badge>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Your Position */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-blue-600 font-medium">Your Position</Label>
                          <div className="text-sm text-gray-600">
                            {form.watch("userZopaVolumen")?.min || 100} - {form.watch("userZopaVolumen")?.max || 1000} 
                            (Target: {form.watch("userZopaVolumen")?.target || 500})
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex space-x-4">
                            <FormField
                              control={form.control}
                              name="userZopaVolumen.min"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Min</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaVolumen.target"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Target</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8 border-blue-300"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaVolumen.max"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Max</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {/* Visual Spectrum */}
                          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="absolute h-full bg-blue-200 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaVolumen")?.min || 100) / 1000) * 100}%`,
                                width: `${(((form.watch("userZopaVolumen")?.max || 1000) - (form.watch("userZopaVolumen")?.min || 100)) / 1000) * 100}%`
                              }}
                            />
                            <div 
                              className="absolute w-2 h-full bg-blue-600 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaVolumen")?.target || 500) / 1000) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Counterpart Assessment */}
                      <div className="space-y-3">
                        <Label className="text-red-600 font-medium">Counterpart Assessment</Label>
                        <FormField
                          control={form.control}
                          name="counterpartDistanceVolumen"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-4">
                                <Label className="text-sm min-w-[60px]">Position:</Label>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                  <FormControl>
                                    <SelectTrigger className="w-[200px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="-1">Weit entfernt (far from your range)</SelectItem>
                                    <SelectItem value="0">Neutral (overlapping)</SelectItem>
                                    <SelectItem value="1">Nah (close to your range)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Counterpart Visual Indicator */}
                        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div className="absolute h-full bg-red-200 rounded-full w-1/3"
                               style={{
                                 left: form.watch("counterpartDistanceVolumen") === -1 ? "10%" : 
                                       form.watch("counterpartDistanceVolumen") === 0 ? "35%" : "60%"
                               }} />
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                  </div>

                  {/* Preis */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Preis (Price)</h3>
                      <Badge variant="outline">EUR</Badge>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Your Position */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-blue-600 font-medium">Your Position</Label>
                          <div className="text-sm text-gray-600">
                            €{form.watch("userZopaPreis")?.min || 10} - €{form.watch("userZopaPreis")?.max || 100} 
                            (Target: €{form.watch("userZopaPreis")?.target || 50})
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex space-x-4">
                            <FormField
                              control={form.control}
                              name="userZopaPreis.min"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Min €</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaPreis.target"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Target €</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8 border-blue-300"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaPreis.max"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Max €</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      step="0.01"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {/* Visual Spectrum */}
                          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="absolute h-full bg-blue-200 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaPreis")?.min || 10) / 100) * 100}%`,
                                width: `${(((form.watch("userZopaPreis")?.max || 100) - (form.watch("userZopaPreis")?.min || 10)) / 100) * 100}%`
                              }}
                            />
                            <div 
                              className="absolute w-2 h-full bg-blue-600 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaPreis")?.target || 50) / 100) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Counterpart Assessment */}
                      <div className="space-y-3">
                        <Label className="text-red-600 font-medium">Counterpart Assessment</Label>
                        <FormField
                          control={form.control}
                          name="counterpartDistancePreis"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-4">
                                <Label className="text-sm min-w-[60px]">Position:</Label>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                  <FormControl>
                                    <SelectTrigger className="w-[200px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="-1">Weit entfernt (far from your range)</SelectItem>
                                    <SelectItem value="0">Neutral (overlapping)</SelectItem>
                                    <SelectItem value="1">Nah (close to your range)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Counterpart Visual Indicator */}
                        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div className="absolute h-full bg-red-200 rounded-full w-1/3"
                               style={{
                                 left: form.watch("counterpartDistancePreis") === -1 ? "10%" : 
                                       form.watch("counterpartDistancePreis") === 0 ? "35%" : "60%"
                               }} />
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                  </div>

                  {/* Laufzeit */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Laufzeit (Duration)</h3>
                      <Badge variant="outline">Months</Badge>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Your Position */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-blue-600 font-medium">Your Position</Label>
                          <div className="text-sm text-gray-600">
                            {form.watch("userZopaLaufzeit")?.min || 12} - {form.watch("userZopaLaufzeit")?.max || 36} months
                            (Target: {form.watch("userZopaLaufzeit")?.target || 24})
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex space-x-4">
                            <FormField
                              control={form.control}
                              name="userZopaLaufzeit.min"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Min months</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaLaufzeit.target"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Target months</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8 border-blue-300"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaLaufzeit.max"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Max months</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {/* Visual Spectrum */}
                          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="absolute h-full bg-blue-200 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaLaufzeit")?.min || 12) / 36) * 100}%`,
                                width: `${(((form.watch("userZopaLaufzeit")?.max || 36) - (form.watch("userZopaLaufzeit")?.min || 12)) / 36) * 100}%`
                              }}
                            />
                            <div 
                              className="absolute w-2 h-full bg-blue-600 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaLaufzeit")?.target || 24) / 36) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Counterpart Assessment */}
                      <div className="space-y-3">
                        <Label className="text-red-600 font-medium">Counterpart Assessment</Label>
                        <FormField
                          control={form.control}
                          name="counterpartDistanceLaufzeit"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-4">
                                <Label className="text-sm min-w-[60px]">Position:</Label>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                  <FormControl>
                                    <SelectTrigger className="w-[200px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="-1">Weit entfernt (far from your range)</SelectItem>
                                    <SelectItem value="0">Neutral (overlapping)</SelectItem>
                                    <SelectItem value="1">Nah (close to your range)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Counterpart Visual Indicator */}
                        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div className="absolute h-full bg-red-200 rounded-full w-1/3"
                               style={{
                                 left: form.watch("counterpartDistanceLaufzeit") === -1 ? "10%" : 
                                       form.watch("counterpartDistanceLaufzeit") === 0 ? "35%" : "60%"
                               }} />
                        </div>
                      </div>
                    </div>
                    
                    <Separator />
                  </div>

                  {/* Zahlungskonditionen */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-semibold">Zahlungskonditionen (Payment Terms)</h3>
                      <Badge variant="outline">Days</Badge>
                    </div>
                    
                    <div className="space-y-6">
                      {/* Your Position */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <Label className="text-blue-600 font-medium">Your Position</Label>
                          <div className="text-sm text-gray-600">
                            {form.watch("userZopaZahlungskonditionen")?.min || 30} - {form.watch("userZopaZahlungskonditionen")?.max || 90} days
                            (Target: {form.watch("userZopaZahlungskonditionen")?.target || 60})
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex space-x-4">
                            <FormField
                              control={form.control}
                              name="userZopaZahlungskonditionen.min"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Min days</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaZahlungskonditionen.target"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Target days</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8 border-blue-300"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                            
                            <FormField
                              control={form.control}
                              name="userZopaZahlungskonditionen.max"
                              render={({ field }) => (
                                <FormItem className="flex-1">
                                  <FormLabel className="text-xs">Max days</FormLabel>
                                  <FormControl>
                                    <Input
                                      type="number"
                                      className="h-8"
                                      {...field}
                                      onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)}
                                    />
                                  </FormControl>
                                </FormItem>
                              )}
                            />
                          </div>
                          
                          {/* Visual Spectrum */}
                          <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                            <div 
                              className="absolute h-full bg-blue-200 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaZahlungskonditionen")?.min || 30) / 90) * 100}%`,
                                width: `${(((form.watch("userZopaZahlungskonditionen")?.max || 90) - (form.watch("userZopaZahlungskonditionen")?.min || 30)) / 90) * 100}%`
                              }}
                            />
                            <div 
                              className="absolute w-2 h-full bg-blue-600 rounded-full"
                              style={{
                                left: `${((form.watch("userZopaZahlungskonditionen")?.target || 60) / 90) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Counterpart Assessment */}
                      <div className="space-y-3">
                        <Label className="text-red-600 font-medium">Counterpart Assessment</Label>
                        <FormField
                          control={form.control}
                          name="counterpartDistanceZahlungskonditionen"
                          render={({ field }) => (
                            <FormItem>
                              <div className="flex items-center space-x-4">
                                <Label className="text-sm min-w-[60px]">Position:</Label>
                                <Select onValueChange={(value) => field.onChange(parseInt(value))} defaultValue={field.value?.toString()}>
                                  <FormControl>
                                    <SelectTrigger className="w-[200px]">
                                      <SelectValue />
                                    </SelectTrigger>
                                  </FormControl>
                                  <SelectContent>
                                    <SelectItem value="-1">Weit entfernt (far from your range)</SelectItem>
                                    <SelectItem value="0">Neutral (overlapping)</SelectItem>
                                    <SelectItem value="1">Nah (close to your range)</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                        
                        {/* Counterpart Visual Indicator */}
                        <div className="relative h-4 bg-gray-100 rounded-full overflow-hidden">
                          <div className="absolute h-full bg-red-200 rounded-full w-1/3"
                               style={{
                                 left: form.watch("counterpartDistanceZahlungskonditionen") === -1 ? "10%" : 
                                       form.watch("counterpartDistanceZahlungskonditionen") === 0 ? "35%" : "60%"
                               }} />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Sonderinteressen */}
                <FormField
                  control={form.control}
                  name="sonderinteressen"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sonderinteressen (Special Interests)</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="e.g., Sustainability requirements, exclusive partnership terms..."
                          {...field}
                        />
                      </FormControl>
                      <p className="text-xs text-gray-600">
                        Additional requirements or special interests that should be considered during negotiation
                      </p>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          )}

          {/* Step 5: Review & Configure */}
          {step === 5 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Play className="w-5 h-5 mr-2" />
                  Review & Configure Simulation
                </CardTitle>
                <CardDescription>
                  Review your configuration and set simulation parameters.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Configuration Summary */}
                <div className="space-y-4">
                  <div className="p-4 bg-gray-50 rounded-lg">
                    <h4 className="font-medium mb-3">Simulation Summary</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Context:</span>
                        <p className="font-medium">{contexts.find(c => c.id === form.watch("contextId"))?.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Max Rounds:</span>
                        <p className="font-medium">{form.watch("maxRounds")}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Buyer Agent:</span>
                        <p className="font-medium">{agents.find(a => a.id === form.watch("buyerAgentId"))?.name}</p>
                      </div>
                      <div>
                        <span className="text-gray-600">Seller Agent:</span>
                        <p className="font-medium">{agents.find(a => a.id === form.watch("sellerAgentId"))?.name}</p>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-blue-700 mb-2">Selected Techniques</h4>
                      <div className="flex flex-wrap gap-2">
                        {form.watch("selectedTechniques")?.map(id => {
                          const technique = sampleTechniques.find(t => t.id === id);
                          return <Badge key={id} variant="secondary">{technique?.name}</Badge>;
                        })}
                      </div>
                    </div>

                    <div className="p-4 border rounded-lg">
                      <h4 className="font-medium text-green-700 mb-2">Selected Tactics</h4>
                      <div className="flex flex-wrap gap-2">
                        {form.watch("selectedTactics")?.map(id => {
                          const tactic = sampleTactics.find(t => t.id === id);
                          return <Badge key={id} variant="secondary">{tactic?.name}</Badge>;
                        })}
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Simulation Settings */}
                <div className="space-y-4">
                  <h4 className="font-medium">Simulation Settings</h4>
                  
                  <FormField
                    control={form.control}
                    name="simulationRuns"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Number of Simulation Runs</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={100}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value))}
                          />
                        </FormControl>
                        <p className="text-xs text-gray-600">
                          Run multiple simulations for statistical analysis and comparison
                        </p>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="autoStart"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            onCheckedChange={field.onChange}
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Auto-start simulation after creation
                          </FormLabel>
                          <p className="text-xs text-gray-600">
                            Automatically begin negotiations once the setup is complete
                          </p>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>
          )}

          {/* Navigation Buttons */}
          <div className="flex justify-between pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={step === 1}
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Previous
            </Button>

            {step < 5 ? (
              <Button
                type="button"
                onClick={nextStep}
                disabled={
                  (step === 1 && !canProceedToStep2) ||
                  (step === 2 && !canProceedToStep3) ||
                  (step === 3 && !canProceedToStep4) ||
                  (step === 4 && !canProceedToStep5)
                }
              >
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            ) : (
              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {createMutation.isPending ? (
                  <div className="flex items-center">
                    <div className="animate-spin w-4 h-4 border-2 border-white border-t-transparent rounded-full mr-2" />
                    Creating...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Create Simulation
                  </div>
                )}
              </Button>
            )}
          </div>
        </form>
      </Form>
    </div>
  );
}