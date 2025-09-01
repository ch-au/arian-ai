import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { 
  BarChart3, 
  Bot, 
  HandMetal, 
  LayoutDashboard, 
  FileText, 
  TestTube, 
  User,
  ChevronDown
} from "lucide-react";

const navigationItems = [
  {
    title: "Negotiations",
    href: "/negotiations", 
    icon: HandMetal,
    description: "Manage negotiations"
  },
  {
    title: "Configure", 
    href: "/configure",
    icon: Bot,
    description: "Setup new negotiation"
  },
  {
    title: "Monitor",
    href: "/monitor",
    icon: LayoutDashboard, 
    description: "Track simulation progress"
  },
  {
    title: "Analysis",
    href: "/analysis",
    icon: BarChart3,
    description: "Cross-negotiation insights"
  },
];

export default function Sidebar() {
  const [location] = useLocation();

  return (
    <aside className="w-64 bg-white shadow-lg flex flex-col">
      {/* Logo & Brand */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center">
            <HandMetal className="text-white text-lg" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">ARIAN</h1>
            <p className="text-sm text-gray-500">AI Negotiation Platform</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1 p-4">
        <ul className="space-y-2">
          {navigationItems.map((item) => {
            const isActive = location === item.href;
            const Icon = item.icon;
            
            return (
              <li key={item.href}>
                <Link href={item.href}>
                  <Button
                    variant="ghost"
                    className={cn(
                      "w-full justify-start h-16 px-4 py-3 flex items-start",
                      isActive 
                        ? "bg-primary/10 text-primary hover:bg-primary/15" 
                        : "text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    <Icon className="w-5 h-5 mr-3 mt-0.5 flex-shrink-0" />
                    <div className="flex flex-col items-start text-left">
                      <span className="font-medium text-sm">{item.title}</span>
                      <span className="text-xs text-gray-500 mt-0.5 leading-tight">
                        {(item as any).description}
                      </span>
                    </div>
                  </Button>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User Section */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center space-x-3 p-3 hover:bg-gray-50 rounded-lg cursor-pointer">
          <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
            <User className="text-white text-sm" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-gray-900">Admin User</p>
            <p className="text-xs text-gray-500">admin@arian.ai</p>
          </div>
          <ChevronDown className="text-gray-400 text-xs" />
        </div>
      </div>
    </aside>
  );
}
