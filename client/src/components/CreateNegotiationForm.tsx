import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Users, Settings, Target, Play } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const createNegotiationSchema = z.object({
  contextId: z.string().min(1, "Please select a negotiation context"),
  buyerAgentId: z.string().min(1, "Please select a buyer agent"),
  sellerAgentId: z.string().min(1, "Please select a seller agent"),
  maxRounds: z.number().min(1).max(50),
  autoStart: z.boolean().default(false),
});

type CreateNegotiationForm = z.infer<typeof createNegotiationSchema>;

interface Props {
  agents: any[];
  contexts: any[];
  onSuccess: () => void;
}

export default function CreateNegotiationForm({ agents, contexts, onSuccess }: Props) {
  const [step, setStep] = useState(1);
  const { toast } = useToast();

  const form = useForm<CreateNegotiationForm>({
    resolver: zodResolver(createNegotiationSchema),
    defaultValues: {
      maxRounds: 10,
      autoStart: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: CreateNegotiationForm) => {
      const response = await apiRequest("POST", "/api/negotiations", {
        contextId: data.contextId,
        buyerAgentId: data.buyerAgentId,
        sellerAgentId: data.sellerAgentId,
        maxRounds: data.maxRounds,
        status: "pending",
      });
      return response.json();
    },
    onSuccess: async (negotiation) => {
      queryClient.invalidateQueries({ queryKey: ["/api/negotiations"] });
      
      // Auto-start if requested
      if (form.getValues().autoStart) {
        try {
          await apiRequest("POST", `/api/negotiations/${negotiation.id}/start`);
          toast({
            title: "Negotiation Created & Started",
            description: "Your negotiation has been created and started successfully.",
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
          description: "Your negotiation has been created successfully.",
        });
      }
      
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Failed to create negotiation",
        description: error instanceof Error ? error.message : "An unknown error occurred",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: CreateNegotiationForm) => {
    createMutation.mutate(data);
  };

  const selectedContext = contexts.find(c => c.id === form.watch("contextId"));
  const selectedBuyer = agents.find(a => a.id === form.watch("buyerAgentId"));
  const selectedSeller = agents.find(a => a.id === form.watch("sellerAgentId"));

  const canProceedToStep2 = form.watch("contextId");
  const canProceedToStep3 = canProceedToStep2 && form.watch("buyerAgentId") && form.watch("sellerAgentId");

  return (
    <div className="space-y-6">
      {/* Progress Steps */}
      <div className="flex items-center justify-center space-x-4 mb-8">
        {[1, 2, 3].map((stepNum) => (
          <div key={stepNum} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step >= stepNum
                  ? "bg-blue-600 text-white"
                  : "bg-gray-200 text-gray-600"
              }`}
            >
              {stepNum}
            </div>
            {stepNum < 3 && (
              <div
                className={`w-16 h-1 mx-2 ${
                  step > stepNum ? "bg-blue-600" : "bg-gray-200"
                }`}
              />
            )}
          </div>
        ))}
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {/* Step 1: Context Selection */}
          {step === 1 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Target className="h-5 w-5" />
                  Step 1: Choose Negotiation Context
                </CardTitle>
                <CardDescription>
                  Select the type of negotiation scenario you want to simulate
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

                {selectedContext && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-medium text-blue-900 mb-2">{selectedContext.name}</h4>
                    <p className="text-sm text-blue-700">{selectedContext.description}</p>
                    {selectedContext.productInfo && (
                      <div className="mt-2">
                        <p className="text-xs text-blue-600">
                          Product: {JSON.stringify(selectedContext.productInfo)}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={() => setStep(2)}
                    disabled={!canProceedToStep2}
                  >
                    Next: Select Agents
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 2: Agent Selection */}
          {step === 2 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Step 2: Choose Negotiation Agents
                </CardTitle>
                <CardDescription>
                  Select the AI agents that will represent the buyer and seller
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

                {selectedBuyer && selectedSeller && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                    <div className="p-4 bg-blue-50 rounded-lg">
                      <h4 className="font-medium text-blue-900 mb-2">Buyer: {selectedBuyer.name}</h4>
                      <p className="text-sm text-blue-700 mb-2">{selectedBuyer.description}</p>
                      <div className="flex gap-1">
                        <Badge variant="secondary">Power: {selectedBuyer.powerLevel}</Badge>
                      </div>
                    </div>
                    <div className="p-4 bg-green-50 rounded-lg">
                      <h4 className="font-medium text-green-900 mb-2">Seller: {selectedSeller.name}</h4>
                      <p className="text-sm text-green-700 mb-2">{selectedSeller.description}</p>
                      <div className="flex gap-1">
                        <Badge variant="secondary">Power: {selectedSeller.powerLevel}</Badge>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(1)}>
                    Back
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setStep(3)}
                    disabled={!canProceedToStep3}
                  >
                    Next: Configure Settings
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Step 3: Configuration & Review */}
          {step === 3 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Step 3: Configure & Create
                </CardTitle>
                <CardDescription>
                  Set negotiation parameters and review your configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
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
                      <FormDescription>
                        Maximum number of negotiation rounds (1-50)
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Separator />

                <div className="space-y-4">
                  <h4 className="font-medium">Review Configuration</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Context</p>
                      <p className="text-sm text-muted-foreground">{selectedContext?.name}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Max Rounds</p>
                      <p className="text-sm text-muted-foreground">{form.watch("maxRounds")}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Buyer Agent</p>
                      <p className="text-sm text-muted-foreground">{selectedBuyer?.name}</p>
                    </div>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Seller Agent</p>
                      <p className="text-sm text-muted-foreground">{selectedSeller?.name}</p>
                    </div>
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button type="button" variant="outline" onClick={() => setStep(2)}>
                    Back
                  </Button>
                  <div className="flex gap-2">
                    <Button
                      type="submit"
                      variant="outline"
                      disabled={createMutation.isPending}
                      onClick={() => form.setValue("autoStart", false)}
                    >
                      Create Negotiation
                    </Button>
                    <Button
                      type="submit"
                      disabled={createMutation.isPending}
                      onClick={() => form.setValue("autoStart", true)}
                    >
                      <Play className="w-4 h-4 mr-2" />
                      Create & Start
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </form>
      </Form>
    </div>
  );
}