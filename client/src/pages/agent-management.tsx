import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PlusCircle, Edit, Trash2 } from "lucide-react";
import AgentForm from "@/components/agent-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";

export default function AgentManagement() {
  const queryClient = useQueryClient();
  const [selectedAgent, setSelectedAgent] = useState<any | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);

  const { data: agents = [], isLoading, isError } = useQuery<any[]>({
    queryKey: ["/api/agents"],
    queryFn: () => apiRequest("GET", "/api/agents").then(res => res.json()),
  });

  const mutation = useMutation({
    mutationFn: (agentData: any) => {
      const url = selectedAgent ? `/api/agents/${selectedAgent.id}` : "/api/agents";
      const method = selectedAgent ? "PUT" : "POST";
      return apiRequest(method, url, agentData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agents"] });
      setIsFormOpen(false);
      setSelectedAgent(null);
    },
  });

  const handleFormSubmit = (data: any) => {
    mutation.mutate(data);
  };

  const openForm = (agent: any | null = null) => {
    setSelectedAgent(agent);
    setIsFormOpen(true);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Agent Management</h1>
          <p className="text-muted-foreground mt-2">
            Create, edit, and manage your AI negotiation agents.
          </p>
        </div>
        <Dialog open={isFormOpen} onOpenChange={setIsFormOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => openForm()}>
              <PlusCircle className="w-4 h-4 mr-2" />
              Add New Agent
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{selectedAgent ? "Edit Agent" : "Create New Agent"}</DialogTitle>
            </DialogHeader>
            <AgentForm agent={selectedAgent} onSubmit={handleFormSubmit} />
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Available Agents</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && <p>Loading agents...</p>}
          {isError && <p className="text-red-500">Failed to load agents.</p>}
          {!isLoading && !isError && (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Personality</TableHead>
                  <TableHead>Power Level</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agents.map((agent) => (
                  <TableRow key={agent.id}>
                    <TableCell className="font-medium">{agent.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{agent.personality}</TableCell>
                    <TableCell>{agent.powerLevel}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="icon" onClick={() => openForm(agent)}>
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-red-500">
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
