/**
 * Screen 4: Gegenseite
 * Free text description with voice input + negotiation mode selector
 */

import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { VoiceInput, VoiceInputInfo } from '@/components/VoiceInput';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

export interface GegenseiteData {
  beschreibungGegenseite: string;
  verhandlungsModus: 'kooperativ' | 'moderat' | 'aggressiv' | 'sehr-aggressiv';
  geschätzteDistanz: {
    volumen: number; // -1 to 1
    preis: number;
    laufzeit: number;
    zahlungskonditionen: number;
  };
}

interface GegenseiteStepProps {
  data: GegenseiteData;
  onChange: (data: Partial<GegenseiteData>) => void;
}

export function GegenseiteStep({ data, onChange }: GegenseiteStepProps) {
  const { t } = useTranslation('configure');

  const getModusBadgeVariant = (modus: GegenseiteData['verhandlungsModus']) => {
    switch (modus) {
      case 'kooperativ':
        return 'default';
      case 'moderat':
        return 'secondary';
      case 'aggressiv':
        return 'destructive';
      case 'sehr-aggressiv':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const getDistanzLabel = (value: number): string => {
    if (value < -0.6) return t('gegenseite.distanz.veryFar');
    if (value < -0.2) return t('gegenseite.distanz.far');
    if (value < 0.2) return t('gegenseite.distanz.close');
    if (value < 0.6) return t('gegenseite.distanz.veryClose');
    return t('gegenseite.distanz.aligned');
  };

  const getDistanzColor = (value: number): string => {
    if (value < -0.6) return 'text-red-600';
    if (value < -0.2) return 'text-orange-600';
    if (value < 0.2) return 'text-yellow-600';
    if (value < 0.6) return 'text-green-600';
    return 'text-emerald-600';
  };

  return (
    <div className="space-y-6">
      {/* Beschreibung der Gegenseite mit Voice Input */}
      <Card>
        <CardHeader>
          <CardTitle>{t('gegenseite.beschreibung.label')}</CardTitle>
          <CardDescription>{t('gegenseite.beschreibung.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              value={data.beschreibungGegenseite}
              onChange={(e) => onChange({ beschreibungGegenseite: e.target.value })}
              placeholder={t('gegenseite.beschreibung.placeholder')}
              rows={6}
              className="flex-1"
            />
            <VoiceInput
              onTranscript={(text) => {
                const newText = data.beschreibungGegenseite
                  ? `${data.beschreibungGegenseite}\n\n${text}`
                  : text;
                onChange({ beschreibungGegenseite: newText });
              }}
              language="de"
            />
          </div>
          <VoiceInputInfo />
        </CardContent>
      </Card>

      {/* Verhandlungs-Modus */}
      <Card>
        <CardHeader>
          <CardTitle>{t('gegenseite.modus.label')}</CardTitle>
          <CardDescription>{t('gegenseite.modus.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={data.verhandlungsModus}
            onValueChange={(value) =>
              onChange({ verhandlungsModus: value as GegenseiteData['verhandlungsModus'] })
            }
            className="space-y-3"
          >
            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors">
              <RadioGroupItem value="kooperativ" id="kooperativ" />
              <div className="flex-1 cursor-pointer" onClick={() => onChange({ verhandlungsModus: 'kooperativ' })}>
                <div className="flex items-center gap-2">
                  <Label htmlFor="kooperativ" className="font-medium cursor-pointer">
                    {t('gegenseite.modus.kooperativ')}
                  </Label>
                  <Badge variant={getModusBadgeVariant('kooperativ') as any}>
                    {t('gegenseite.modus.badges.kooperativ')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('gegenseite.modus.kooperativDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors">
              <RadioGroupItem value="moderat" id="moderat" />
              <div className="flex-1 cursor-pointer" onClick={() => onChange({ verhandlungsModus: 'moderat' })}>
                <div className="flex items-center gap-2">
                  <Label htmlFor="moderat" className="font-medium cursor-pointer">
                    {t('gegenseite.modus.moderat')}
                  </Label>
                  <Badge variant={getModusBadgeVariant('moderat') as any}>
                    {t('gegenseite.modus.badges.moderat')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('gegenseite.modus.moderatDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors">
              <RadioGroupItem value="aggressiv" id="aggressiv" />
              <div className="flex-1 cursor-pointer" onClick={() => onChange({ verhandlungsModus: 'aggressiv' })}>
                <div className="flex items-center gap-2">
                  <Label htmlFor="aggressiv" className="font-medium cursor-pointer">
                    {t('gegenseite.modus.aggressiv')}
                  </Label>
                  <Badge variant={getModusBadgeVariant('aggressiv') as any}>
                    {t('gegenseite.modus.badges.aggressiv')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('gegenseite.modus.aggressivDesc')}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-accent transition-colors">
              <RadioGroupItem value="sehr-aggressiv" id="sehr-aggressiv" />
              <div className="flex-1 cursor-pointer" onClick={() => onChange({ verhandlungsModus: 'sehr-aggressiv' })}>
                <div className="flex items-center gap-2">
                  <Label htmlFor="sehr-aggressiv" className="font-medium cursor-pointer">
                    {t('gegenseite.modus.sehrAggressiv')}
                  </Label>
                  <Badge variant={getModusBadgeVariant('sehr-aggressiv') as any}>
                    {t('gegenseite.modus.badges.sehrAggressiv')}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {t('gegenseite.modus.sehrAggressivDesc')}
                </p>
              </div>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Geschätzte Distanz zur Position */}
      <Card>
        <CardHeader>
          <CardTitle>{t('gegenseite.distanz.label')}</CardTitle>
          <CardDescription>{t('gegenseite.distanz.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Info Banner */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-blue-700">{t('gegenseite.distanz.info')}</p>
          </div>

          {/* Volumen */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('gegenseite.distanz.volumen')}</Label>
              <span className={`text-sm font-semibold ${getDistanzColor(data.geschätzteDistanz.volumen)}`}>
                {getDistanzLabel(data.geschätzteDistanz.volumen)}
              </span>
            </div>
            <Slider
              value={[data.geschätzteDistanz.volumen]}
              onValueChange={([value]) =>
                onChange({
                  geschätzteDistanz: { ...data.geschätzteDistanz, volumen: value },
                })
              }
              min={-1}
              max={1}
              step={0.1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('gegenseite.distanz.veryFar')}</span>
              <span>{t('gegenseite.distanz.aligned')}</span>
            </div>
          </div>

          {/* Preis */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('gegenseite.distanz.preis')}</Label>
              <span className={`text-sm font-semibold ${getDistanzColor(data.geschätzteDistanz.preis)}`}>
                {getDistanzLabel(data.geschätzteDistanz.preis)}
              </span>
            </div>
            <Slider
              value={[data.geschätzteDistanz.preis]}
              onValueChange={([value]) =>
                onChange({
                  geschätzteDistanz: { ...data.geschätzteDistanz, preis: value },
                })
              }
              min={-1}
              max={1}
              step={0.1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('gegenseite.distanz.veryFar')}</span>
              <span>{t('gegenseite.distanz.aligned')}</span>
            </div>
          </div>

          {/* Laufzeit */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('gegenseite.distanz.laufzeit')}</Label>
              <span className={`text-sm font-semibold ${getDistanzColor(data.geschätzteDistanz.laufzeit)}`}>
                {getDistanzLabel(data.geschätzteDistanz.laufzeit)}
              </span>
            </div>
            <Slider
              value={[data.geschätzteDistanz.laufzeit]}
              onValueChange={([value]) =>
                onChange({
                  geschätzteDistanz: { ...data.geschätzteDistanz, laufzeit: value },
                })
              }
              min={-1}
              max={1}
              step={0.1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('gegenseite.distanz.veryFar')}</span>
              <span>{t('gegenseite.distanz.aligned')}</span>
            </div>
          </div>

          {/* Zahlungskonditionen */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>{t('gegenseite.distanz.zahlungskonditionen')}</Label>
              <span className={`text-sm font-semibold ${getDistanzColor(data.geschätzteDistanz.zahlungskonditionen)}`}>
                {getDistanzLabel(data.geschätzteDistanz.zahlungskonditionen)}
              </span>
            </div>
            <Slider
              value={[data.geschätzteDistanz.zahlungskonditionen]}
              onValueChange={([value]) =>
                onChange({
                  geschätzteDistanz: { ...data.geschätzteDistanz, zahlungskonditionen: value },
                })
              }
              min={-1}
              max={1}
              step={0.1}
            />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{t('gegenseite.distanz.veryFar')}</span>
              <span>{t('gegenseite.distanz.aligned')}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
