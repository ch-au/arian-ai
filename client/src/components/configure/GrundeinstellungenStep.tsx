/**
 * Screen 1: Grundeinstellungen
 * Erweitert mit: Unternehmens-Bekanntheit, Macht-Balance, Max Runden, Voice Input
 */

import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { VoiceInput, VoiceInputInfo } from '@/components/VoiceInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export interface GrundeinstellungenData {
  title: string;
  userRole: 'buyer' | 'seller';
  negotiationType: 'one-shot' | 'multi-year';

  // NEU: Phase 2 Felder
  companyKnown: boolean;
  counterpartKnown: boolean;
  negotiationFrequency: 'yearly' | 'quarterly' | 'monthly' | 'ongoing';
  powerBalance: number; // 0-100
  maxRounds: number; // 1-15
  marktProduktKontext: string; // Markt- und Produktbeschreibung
  wichtigerKontext: string;
}

interface GrundeinstellungenStepProps {
  data: GrundeinstellungenData;
  onChange: (data: Partial<GrundeinstellungenData>) => void;
}

export function GrundeinstellungenStep({ data, onChange }: GrundeinstellungenStepProps) {
  const { t } = useTranslation('configure');

  const getPowerBalanceLabel = (value: number): string => {
    if (value < 33) return t('grundeinstellungen.powerBalance.sellerPower');
    if (value > 67) return t('grundeinstellungen.powerBalance.buyerPower');
    return t('grundeinstellungen.powerBalance.balanced');
  };

  return (
    <div className="space-y-6">
      {/* Verhandlungstitel */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.title.label')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            value={data.title}
            onChange={(e) => onChange({ title: e.target.value })}
            placeholder={t('grundeinstellungen.title.placeholder')}
          />
        </CardContent>
      </Card>

      {/* Ihre Rolle */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.userRole.label')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={data.userRole}
            onValueChange={(value) => onChange({ userRole: value as 'buyer' | 'seller' })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="buyer" id="buyer" />
              <Label htmlFor="buyer">{t('grundeinstellungen.userRole.buyer')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="seller" id="seller" />
              <Label htmlFor="seller">{t('grundeinstellungen.userRole.seller')}</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Verhandlungsart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.negotiationType.label')}</CardTitle>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={data.negotiationType}
            onValueChange={(value) => onChange({ negotiationType: value as 'one-shot' | 'multi-year' })}
          >
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="one-shot" id="one-shot" />
              <Label htmlFor="one-shot">{t('grundeinstellungen.negotiationType.oneShot')}</Label>
            </div>
            <div className="flex items-center space-x-2">
              <RadioGroupItem value="multi-year" id="multi-year" />
              <Label htmlFor="multi-year">{t('grundeinstellungen.negotiationType.multiYear')}</Label>
            </div>
          </RadioGroup>
        </CardContent>
      </Card>

      {/* Unternehmens-Bekanntheit */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.companyKnown.label')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="company-known">
              {data.companyKnown ? t('grundeinstellungen.companyKnown.yes') : t('grundeinstellungen.companyKnown.no')}
            </Label>
            <Switch
              id="company-known"
              checked={data.companyKnown}
              onCheckedChange={(checked) => onChange({ companyKnown: checked })}
            />
          </div>

          <div className="flex items-center justify-between">
            <Label htmlFor="counterpart-known">
              {data.counterpartKnown ? t('grundeinstellungen.counterpartKnown.yes') : t('grundeinstellungen.counterpartKnown.no')}
            </Label>
            <Switch
              id="counterpart-known"
              checked={data.counterpartKnown}
              onCheckedChange={(checked) => onChange({ counterpartKnown: checked })}
            />
          </div>
        </CardContent>
      </Card>

      {/* Verhandlungsfrequenz */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.negotiationFrequency.label')}</CardTitle>
        </CardHeader>
        <CardContent>
          <Select
            value={data.negotiationFrequency}
            onValueChange={(value) => onChange({ negotiationFrequency: value as any })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="yearly">{t('grundeinstellungen.negotiationFrequency.yearly')}</SelectItem>
              <SelectItem value="quarterly">{t('grundeinstellungen.negotiationFrequency.quarterly')}</SelectItem>
              <SelectItem value="monthly">{t('grundeinstellungen.negotiationFrequency.monthly')}</SelectItem>
              <SelectItem value="ongoing">{t('grundeinstellungen.negotiationFrequency.ongoing')}</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Macht-Balance Slider */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.powerBalance.label')}</CardTitle>
          <CardDescription>{t('grundeinstellungen.powerBalance.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Slider
            value={[data.powerBalance]}
            onValueChange={([value]) => onChange({ powerBalance: value })}
            min={0}
            max={100}
            step={5}
          />
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{t('grundeinstellungen.powerBalance.sellerPower')}</span>
            <span className="font-semibold text-foreground">{getPowerBalanceLabel(data.powerBalance)}</span>
            <span>{t('grundeinstellungen.powerBalance.buyerPower')}</span>
          </div>
          <div className="text-center text-lg font-mono">{data.powerBalance}</div>
        </CardContent>
      </Card>

      {/* Max Runden Slider */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.maxRounds.label')}</CardTitle>
          <CardDescription>{t('grundeinstellungen.maxRounds.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Slider
            value={[data.maxRounds]}
            onValueChange={([value]) => onChange({ maxRounds: value })}
            min={1}
            max={15}
            step={1}
          />
          <div className="text-center">
            <span className="text-3xl font-bold">{data.maxRounds}</span>
            <span className="text-muted-foreground ml-2">Runden</span>
          </div>
        </CardContent>
      </Card>

      {/* Markt- und Produktkontext */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.marktProduktKontext.label')}</CardTitle>
          <CardDescription>{t('grundeinstellungen.marktProduktKontext.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={data.marktProduktKontext}
            onChange={(e) => onChange({ marktProduktKontext: e.target.value })}
            placeholder={t('grundeinstellungen.marktProduktKontext.placeholder')}
            rows={4}
          />
        </CardContent>
      </Card>

      {/* Wichtiger Kontext mit Voice Input */}
      <Card>
        <CardHeader>
          <CardTitle>{t('grundeinstellungen.importantContext.label')}</CardTitle>
          <CardDescription>{t('grundeinstellungen.importantContext.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Textarea
              value={data.wichtigerKontext}
              onChange={(e) => onChange({ wichtigerKontext: e.target.value })}
              placeholder={t('grundeinstellungen.importantContext.placeholder')}
              rows={4}
              className="flex-1"
            />
            <VoiceInput
              onTranscript={(text) => {
                // Append to existing text
                const newText = data.wichtigerKontext
                  ? `${data.wichtigerKontext}\n\n${text}`
                  : text;
                onChange({ wichtigerKontext: newText });
              }}
              language="de"
            />
          </div>
          <VoiceInputInfo />
        </CardContent>
      </Card>
    </div>
  );
}
