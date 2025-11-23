import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Analysis Page - Redirects to Negotiations List
 * 
 * This page was a placeholder. Users should navigate to:
 * - `/analysis/:negotiationId` for specific negotiation analysis
 * - `/negotiations/:id/analysis` for detailed negotiation analysis
 */
export default function Analysis() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to dashboard where users can select an analysis
    setLocation("/");
  }, [setLocation]);

  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <p className="text-gray-600">Redirecting to negotiations...</p>
      </div>
    </div>
  );
}
