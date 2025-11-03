/**
 * Screen 5: Review & Submit
 * Summary of all configuration + AI Market Intelligence
 */

import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Loader, Sparkles, ExternalLink, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReviewStepProps {
  negotiationTitle: string;
  userRole: 'buyer' | 'seller';
  negotiationType: 'one-shot' | 'multi-year';
  productCount: number;
  conditionCount: number;
  tacticCount: number;
  techniqueCount: number;
  verhandlungsModus: string;
  onGenerateIntelligence: () => Promise<void>;
  marketIntelligence?: MarketIntelligenceItem[];
  isLoadingIntelligence?: boolean;
}

export interface MarketIntelligenceItem {
  aspekt: string;
  quelle: string;
  relevanz: 'hoch' | 'mittel' | 'niedrig';
}

export function ReviewStep({
  negotiationTitle,
  userRole,
  negotiationType,
  productCount,
  conditionCount,
  tacticCount,
  techniqueCount,
  verhandlungsModus,
  onGenerateIntelligence,
  marketIntelligence = [],
  isLoadingIntelligence = false,
}: ReviewStepProps) {
  const { t } = useTranslation('configure');
  const { toast } = useToast();
  const [showIntelligence, setShowIntelligence] = useState(false);

  const totalCombinations = tacticCount * techniqueCount;

  const handleGenerateIntelligence = async () => {
    // Validate required fields before generating
    if (!negotiationTitle || !negotiationTitle.trim()) {
      toast({
        title: "Fehler",
        description: "Bitte geben Sie einen Verhandlungstitel ein",
        variant: "destructive",
      });
      return;
    }
    
    setShowIntelligence(true);
    await onGenerateIntelligence();
  };

  return (
    <div className="space-y-6">
      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle>{t('review.summary.title')}</CardTitle>
          <CardDescription>{t('review.summary.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Title & Role */}
          <div>
            <h3 className="text-2xl font-bold">{negotiationTitle}</h3>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline">
                {t(`grundeinstellungen.userRole.${userRole}`)}
              </Badge>
              <Badge variant="secondary">
                {t(`grundeinstellungen.negotiationType.${negotiationType === 'one-shot' ? 'oneShot' : 'multiYear'}`)}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Dimensions Summary */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">{t('review.summary.products')}</div>
              <div className="text-2xl font-semibold">{productCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('review.summary.conditions')}</div>
              <div className="text-2xl font-semibold">{conditionCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('review.summary.tactics')}</div>
              <div className="text-2xl font-semibold">{tacticCount}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">{t('review.summary.techniques')}</div>
              <div className="text-2xl font-semibold">{techniqueCount}</div>
            </div>
          </div>

          <Separator />

          {/* Simulation Summary */}
          <div className="p-4 bg-primary/10 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{t('review.summary.totalSimulations')}</div>
                <div className="text-xs text-muted-foreground mt-1">
                  {tacticCount} {t('review.summary.tactics')} × {techniqueCount}{' '}
                  {t('review.summary.techniques')}
                </div>
              </div>
              <div className="text-4xl font-bold text-primary">{totalCombinations}</div>
            </div>
          </div>

          {/* Gegenseite Summary */}
          <div>
            <div className="text-sm text-muted-foreground mb-1">{t('review.summary.counterpartMode')}</div>
            <Badge variant="outline" className="text-base">
              {t(`gegenseite.modus.${verhandlungsModus}`)}
            </Badge>
          </div>
        </CardContent>
      </Card>

      {/* Market Intelligence */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-yellow-500" />
                {t('review.intelligence.title')}
              </CardTitle>
              <CardDescription>{t('review.intelligence.description')}</CardDescription>
            </div>
            {!showIntelligence && (
              <Button onClick={handleGenerateIntelligence} disabled={isLoadingIntelligence}>
                {isLoadingIntelligence ? (
                  <>
                    <Loader className="h-4 w-4 mr-2 animate-spin" />
                    {t('review.intelligence.generating')}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    {t('review.intelligence.generate')}
                  </>
                )}
              </Button>
            )}
          </div>
        </CardHeader>

        {showIntelligence && (
          <CardContent className="space-y-4">
            {isLoadingIntelligence ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center space-y-3">
                  <Loader className="h-8 w-8 animate-spin mx-auto text-primary" />
                  <p className="text-sm text-muted-foreground">
                    {t('review.intelligence.analyzing')}
                  </p>
                </div>
              </div>
            ) : marketIntelligence.length > 0 ? (
              <div className="space-y-3">
                {marketIntelligence.map((item, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-2 hover:bg-accent transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium flex-1">{item.aspekt}</p>
                      <Badge
                        variant={
                          item.relevanz === 'hoch'
                            ? 'default'
                            : item.relevanz === 'mittel'
                            ? 'secondary'
                            : 'outline'
                        }
                      >
                        {t(`review.intelligence.relevanz.${item.relevanz}`)}
                      </Badge>
                    </div>
                    {item.quelle && (
                      <a
                        href={item.quelle}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {(() => {
                          try {
                            return new URL(item.quelle).hostname;
                          } catch {
                            return item.quelle;
                          }
                        })()}
                      </a>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex items-start gap-2 p-4 bg-muted rounded-lg">
                <AlertCircle className="h-4 w-4 text-muted-foreground mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  {t('review.intelligence.noResults')}
                </p>
              </div>
            )}
          </CardContent>
        )}
      </Card>

      {/* Submission Info */}
      <Card className="border-primary">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-medium">{t('review.submit.readyTitle')}</p>
              <p className="text-sm text-muted-foreground">{t('review.submit.readyDescription')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
