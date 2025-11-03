/**
 * Screen 3: Taktiken & Techniken (Combined)
 * User selects multiple tactics and techniques to test in simulation
 */

import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';

export interface TaktikenTechnikenData {
  selectedTacticIds: string[];
  selectedTechniqueIds: string[];
}

interface TacticOption {
  id: string;
  name: string;
  description: string;
  category: 'integrative' | 'competitive' | 'defensive';
}

interface TechniqueOption {
  id: string;
  name: string;
  description: string;
  principle: string;
}

interface TaktikenTechnikenStepProps {
  data: TaktikenTechnikenData;
  onChange: (data: Partial<TaktikenTechnikenData>) => void;
  availableTactics: TacticOption[];
  availableTechniques: TechniqueOption[];
}

export function TaktikenTechnikenStep({
  data,
  onChange,
  availableTactics,
  availableTechniques,
}: TaktikenTechnikenStepProps) {
  const { t } = useTranslation('configure');

  const toggleTactic = (tacticId: string) => {
    const isSelected = data.selectedTacticIds.includes(tacticId);
    const newSelection = isSelected
      ? data.selectedTacticIds.filter((id) => id !== tacticId)
      : [...data.selectedTacticIds, tacticId];

    onChange({ selectedTacticIds: newSelection });
  };

  const toggleTechnique = (techniqueId: string) => {
    const isSelected = data.selectedTechniqueIds.includes(techniqueId);
    const newSelection = isSelected
      ? data.selectedTechniqueIds.filter((id) => id !== techniqueId)
      : [...data.selectedTechniqueIds, techniqueId];

    onChange({ selectedTechniqueIds: newSelection });
  };

  const selectAllTactics = () => {
    onChange({ selectedTacticIds: availableTactics.map((t) => t.id) });
  };

  const deselectAllTactics = () => {
    onChange({ selectedTacticIds: [] });
  };

  const selectAllTechniques = () => {
    onChange({ selectedTechniqueIds: availableTechniques.map((t) => t.id) });
  };

  const deselectAllTechniques = () => {
    onChange({ selectedTechniqueIds: [] });
  };

  const getCategoryBadgeVariant = (category: TacticOption['category']) => {
    switch (category) {
      case 'integrative':
        return 'default';
      case 'competitive':
        return 'destructive';
      case 'defensive':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getCategoryLabel = (category: TacticOption['category'] | 'undefined') => {
    if (category === 'undefined' || !category) {
      return t('taktikenTechniken.tactics.categories.undefined');
    }
    return t(`taktikenTechniken.tactics.categories.${category}`);
  };

  // Group tactics by category (handle undefined categories)
  const tacticsByCategory = availableTactics.reduce(
    (acc, tactic) => {
      const category = tactic.category || 'undefined';
      if (!acc[category]) {
        acc[category] = [];
      }
      acc[category].push(tactic);
      return acc;
    },
    {} as Record<string, TacticOption[]>
  );

  const totalCombinations = data.selectedTacticIds.length * data.selectedTechniqueIds.length;

  return (
    <div className="space-y-6">
      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-blue-900">
            {t('taktikenTechniken.info.title')}
          </p>
          <p className="text-sm text-blue-700">
            {t('taktikenTechniken.info.description', { count: totalCombinations })}
          </p>
        </div>
      </div>

      {/* Negotiation Tactics */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('taktikenTechniken.tactics.title')}</CardTitle>
              <CardDescription>
                {t('taktikenTechniken.tactics.description')} ({data.selectedTacticIds.length}{' '}
                {t('taktikenTechniken.selected')})
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllTactics}
                disabled={data.selectedTacticIds.length === availableTactics.length}
              >
                {t('taktikenTechniken.selectAll')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deselectAllTactics}
                disabled={data.selectedTacticIds.length === 0}
              >
                {t('taktikenTechniken.deselectAll')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {Object.keys(tacticsByCategory).map((category) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-sm">{getCategoryLabel(category)}</h4>
                <Badge variant={getCategoryBadgeVariant(category) as any}>
                  {tacticsByCategory[category].length}
                </Badge>
              </div>

              <div className="space-y-3 pl-2">
                {tacticsByCategory[category].map((tactic) => (
                  <div key={tactic.id} className="flex items-start gap-3">
                    <Checkbox
                      id={`tactic-${tactic.id}`}
                      checked={data.selectedTacticIds.includes(tactic.id)}
                      onCheckedChange={() => toggleTactic(tactic.id)}
                      className="mt-1"
                    />
                    <div className="flex-1 cursor-pointer" onClick={() => toggleTactic(tactic.id)}>
                      <Label
                        htmlFor={`tactic-${tactic.id}`}
                        className="font-medium cursor-pointer"
                      >
                        {tactic.name}
                      </Label>
                      <p className="text-sm text-muted-foreground mt-1">{tactic.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Influencing Techniques */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{t('taktikenTechniken.techniques.title')}</CardTitle>
              <CardDescription>
                {t('taktikenTechniken.techniques.description')} ({data.selectedTechniqueIds.length}{' '}
                {t('taktikenTechniken.selected')})
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAllTechniques}
                disabled={data.selectedTechniqueIds.length === availableTechniques.length}
              >
                {t('taktikenTechniken.selectAll')}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={deselectAllTechniques}
                disabled={data.selectedTechniqueIds.length === 0}
              >
                {t('taktikenTechniken.deselectAll')}
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {availableTechniques.map((technique) => (
            <div key={technique.id} className="flex items-start gap-3">
              <Checkbox
                id={`technique-${technique.id}`}
                checked={data.selectedTechniqueIds.includes(technique.id)}
                onCheckedChange={() => toggleTechnique(technique.id)}
                className="mt-1"
              />
              <div className="flex-1 cursor-pointer" onClick={() => toggleTechnique(technique.id)}>
                <Label
                  htmlFor={`technique-${technique.id}`}
                  className="font-medium cursor-pointer"
                >
                  {technique.name}
                </Label>
                <p className="text-sm text-muted-foreground mt-1">{technique.description}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="outline" className="text-xs">
                    {technique.principle}
                  </Badge>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Combinations Summary */}
      {totalCombinations > 0 && (
        <Card className="border-primary">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <div className="text-sm text-muted-foreground">
                {t('taktikenTechniken.summary.totalCombinations')}
              </div>
              <div className="text-4xl font-bold text-primary">{totalCombinations}</div>
              <div className="text-sm text-muted-foreground">
                {data.selectedTacticIds.length} {t('taktikenTechniken.summary.tactics')} ×{' '}
                {data.selectedTechniqueIds.length} {t('taktikenTechniken.summary.techniques')}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
