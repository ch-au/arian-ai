/**
 * Negotiation Configuration Display
 * Shows read-only parameters of the negotiation
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FileText, Users, Target, Zap } from "lucide-react";

interface NegotiationConfigProps {
  negotiation: any;
  techniques?: any[];
  tactics?: any[];
}

export function NegotiationConfig({ negotiation, techniques = [], tactics = [] }: NegotiationConfigProps) {
  const selectedTechniqueNames = negotiation?.selectedTechniques?.map((id: string) =>
    techniques.find(t => t.id === id)?.name || id.slice(0, 8)
  ) || [];

  const selectedTacticNames = negotiation?.selectedTactics?.map((id: string) =>
    tactics.find(t => t.id === id)?.name || id.slice(0, 8)
  ) || [];

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileText className="w-5 h-5" />
          Configuration
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Basic Info */}
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Title</div>
          <div className="text-sm text-gray-900">{negotiation?.title || 'Untitled'}</div>
        </div>

        <Separator />

        {/* Negotiation Setup */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Users className="w-4 h-4" />
            Setup
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-600">Type:</span>
              <Badge variant="outline">{negotiation?.negotiationType || 'one-shot'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Role:</span>
              <Badge variant="outline">{negotiation?.userRole?.toUpperCase() || 'BUYER'}</Badge>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Relationship:</span>
              <span className="text-gray-900">
                {negotiation?.relationshipType === 'first' ? 'First-time' : 'Long-standing'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Max Rounds:</span>
              <span className="font-medium text-gray-900">{negotiation?.maxRounds || 5}</span>
            </div>
          </div>
        </div>

        <Separator />

        {/* Techniques */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Zap className="w-4 h-4" />
            Techniques ({selectedTechniqueNames.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedTechniqueNames.length > 0 ? (
              selectedTechniqueNames.map((name: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-gray-500">None selected</span>
            )}
          </div>
        </div>

        <Separator />

        {/* Tactics */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
            <Target className="w-4 h-4" />
            Tactics ({selectedTacticNames.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {selectedTacticNames.length > 0 ? (
              selectedTacticNames.map((name: string, idx: number) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {name}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-gray-500">None selected</span>
            )}
          </div>
        </div>

        {/* Context */}
        {negotiation?.productMarketDescription && (
          <>
            <Separator />
            <div className="space-y-2">
              <div className="text-sm font-medium text-gray-700">Context</div>
              <div className="text-xs text-gray-600 leading-relaxed">
                {negotiation.productMarketDescription}
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export function NegotiationConfigSkeleton() {
  return (
    <Card className="h-full">
      <CardHeader>
        <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="h-12 bg-gray-200 rounded animate-pulse" />
        <div className="h-24 bg-gray-200 rounded animate-pulse" />
        <div className="h-20 bg-gray-200 rounded animate-pulse" />
      </CardContent>
    </Card>
  );
}
