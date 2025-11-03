import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";

const agentSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  personalityProfile: z.object({
    openness: z.number().min(0).max(1),
    conscientiousness: z.number().min(0).max(1),
    extraversion: z.number().min(0).max(1),
    agreeableness: z.number().min(0).max(1),
    neuroticism: z.number().min(0).max(1),
  }),
  powerLevel: z.number().min(1).max(10),
  preferredTactics: z.array(z.string()).optional(),
});

type AgentFormValues = z.infer<typeof agentSchema>;

interface AgentFormProps {
  agent?: AgentFormValues;
  onSubmit: (data: AgentFormValues) => void;
}

export default function AgentForm({ agent, onSubmit }: AgentFormProps) {
  const form = useForm<AgentFormValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: agent || {
      name: "",
      description: "",
      personalityProfile: {
        openness: 0.5,
        conscientiousness: 0.5,
        extraversion: 0.5,
        agreeableness: 0.5,
        neuroticism: 0.5,
      },
      powerLevel: 5,
      preferredTactics: [],
    },
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g., 'Strategic Buyer'" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Describe the agent's personality and negotiation style."
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="space-y-4">
          <Label>Personality Profile (Big 5 Traits)</Label>
          <FormField
            control={form.control}
            name="personalityProfile.openness"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Openness: {Math.round(field.value * 100)}%</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="personalityProfile.conscientiousness"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Conscientiousness: {Math.round(field.value * 100)}%</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="personalityProfile.extraversion"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Extraversion: {Math.round(field.value * 100)}%</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="personalityProfile.agreeableness"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Agreeableness: {Math.round(field.value * 100)}%</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="personalityProfile.neuroticism"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Neuroticism: {Math.round(field.value * 100)}%</FormLabel>
                <FormControl>
                  <Slider
                    min={0}
                    max={1}
                    step={0.01}
                    value={[field.value]}
                    onValueChange={(value) => field.onChange(value[0])}
                  />
                </FormControl>
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="powerLevel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Power Level: {field.value}</FormLabel>
              <FormControl>
                <Slider
                  min={1}
                  max={10}
                  step={1}
                  value={[field.value]}
                  onValueChange={(value) => field.onChange(value[0])}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Save Agent</Button>
      </form>
    </Form>
  );
}
