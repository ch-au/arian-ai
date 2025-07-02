import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bot, Play, Download, List, Settings, FileText } from "lucide-react";
import { useLocation } from "wouter";

export default function QuickActions() {
  const [, setLocation] = useLocation();

  const actions = [
    {
      title: "Configure Agent",
      description: "Set personality & tactics",
      icon: Bot,
      color: "bg-blue-100 text-blue-600",
      onClick: () => setLocation("/agents"),
    },
    {
      title: "Run Test Suite",
      description: "Multi-scenario testing",
      icon: Play,
      color: "bg-green-100 text-green-600",
      onClick: () => setLocation("/testing"),
    },
    {
      title: "Export Reports",
      description: "Download analytics",
      icon: Download,
      color: "bg-purple-100 text-purple-600",
      onClick: () => setLocation("/reports"),
    },
    {
      title: "View Analytics",
      description: "Performance insights",
      icon: FileText,
      color: "bg-orange-100 text-orange-600",
      onClick: () => setLocation("/analytics"),
    },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-gray-900">Quick Actions</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <Button
                key={action.title}
                variant="ghost"
                className="flex items-center space-x-3 p-4 h-auto border border-gray-200 rounded-lg hover:border-primary/30 hover:bg-primary/5 transition-colors"
                onClick={action.onClick}
              >
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${action.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <p className="font-medium text-gray-900">{action.title}</p>
                  <p className="text-sm text-gray-500">{action.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
