/**
 * Screen 2: Verhandlungsdimensionen
 * - Übergreifende Konditionen (flexible dimensions)
 * - Produkte Tabelle (max 10 products)
 */

import { useTranslation } from 'react-i18next';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Trash2, Plus, AlertCircle } from 'lucide-react';

export interface Produkt {
  id: string;
  produktName: string;
  zielPreis: number;
  minMaxPreis: number;
  geschätztesVolumen: number;
}

export interface Kondition {
  id: string;
  name: string;
  einheit: string;
  minWert: number;
  maxWert: number;
  zielWert: number;
  priorität: 1 | 2 | 3;
}

export interface DimensionenData {
  produkte: Produkt[];
  konditionen: Kondition[];
}

interface DimensionenStepProps {
  data: DimensionenData;
  onChange: (data: Partial<DimensionenData>) => void;
  userRole: 'buyer' | 'seller';
}

export function DimensionenStep({ data, onChange, userRole }: DimensionenStepProps) {
  const { t } = useTranslation('configure');

  // Produkte Management
  const addProdukt = () => {
    if (data.produkte.length >= 10) {
      return; // Max 10 products
    }

    const newProdukt: Produkt = {
      id: crypto.randomUUID(),
      produktName: '',
      zielPreis: 0,
      minMaxPreis: 0,
      geschätztesVolumen: 0,
    };

    onChange({
      produkte: [...data.produkte, newProdukt],
    });
  };

  const removeProdukt = (id: string) => {
    onChange({
      produkte: data.produkte.filter((p) => p.id !== id),
    });
  };

  const updateProdukt = (id: string, updates: Partial<Produkt>) => {
    onChange({
      produkte: data.produkte.map((p) => (p.id === id ? { ...p, ...updates } : p)),
    });
  };

  // Konditionen Management
  const addKondition = () => {
    const newKondition: Kondition = {
      id: crypto.randomUUID(),
      name: '',
      einheit: '',
      minWert: 0,
      maxWert: 0,
      zielWert: 0,
      priorität: 2,
    };

    onChange({
      konditionen: [...data.konditionen, newKondition],
    });
  };

  const removeKondition = (id: string) => {
    onChange({
      konditionen: data.konditionen.filter((k) => k.id !== id),
    });
  };

  const updateKondition = (id: string, updates: Partial<Kondition>) => {
    onChange({
      konditionen: data.konditionen.map((k) => (k.id === id ? { ...k, ...updates } : k)),
    });
  };

  const getMinMaxLabel = () => {
    return userRole === 'buyer'
      ? t('dimensionen.produkte.maxPreis')
      : t('dimensionen.produkte.minPreis');
  };

  return (
    <div className="space-y-6">
      {/* Produkte Tabelle */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dimensionen.produkte.title')}</CardTitle>
          <CardDescription>{t('dimensionen.produkte.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Table Header - Always visible */}
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 pb-2 border-b font-semibold text-sm">
            <div>{t('dimensionen.produkte.produktName')}</div>
            <div>{t('dimensionen.produkte.zielPreis')}</div>
            <div>{getMinMaxLabel()}</div>
            <div>{t('dimensionen.produkte.volumen')}</div>
            <div className="w-10"></div>
          </div>

          {/* Product Rows */}
          {data.produkte.length > 0 ? (
            data.produkte.map((produkt) => (
              <div key={produkt.id} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-4 items-start">
                <Input
                  value={produkt.produktName}
                  onChange={(e) => updateProdukt(produkt.id, { produktName: e.target.value })}
                  placeholder={t('dimensionen.produkte.produktNamePlaceholder')}
                />
                <Input
                  type="number"
                  value={produkt.zielPreis || ''}
                  onChange={(e) =>
                    updateProdukt(produkt.id, { zielPreis: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
                <Input
                  type="number"
                  value={produkt.minMaxPreis || ''}
                  onChange={(e) =>
                    updateProdukt(produkt.id, { minMaxPreis: parseFloat(e.target.value) || 0 })
                  }
                  placeholder="0.00"
                />
                <Input
                  type="number"
                  value={produkt.geschätztesVolumen || ''}
                  onChange={(e) =>
                    updateProdukt(produkt.id, { geschätztesVolumen: parseInt(e.target.value) || 0 })
                  }
                  placeholder="0"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeProdukt(produkt.id)}
                  title={t('dimensionen.produkte.remove')}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
              <p className="text-sm mb-4">Keine Produkte hinzugefügt</p>
              <p className="text-xs">Klicken Sie auf "Produkt hinzufügen" um zu beginnen</p>
            </div>
          )}

          {/* Add Product Button */}
          {data.produkte.length < 10 ? (
            <Button
              type="button"
              variant="outline"
              onClick={addProdukt}
              className="w-full"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('dimensionen.produkte.add')}
            </Button>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 bg-muted rounded-md">
              <AlertCircle className="h-4 w-4" />
              <span>{t('dimensionen.produkte.maxLimit')}</span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Übergreifende Konditionen */}
      <Card>
        <CardHeader>
          <CardTitle>{t('dimensionen.konditionen.title')}</CardTitle>
          <CardDescription>{t('dimensionen.konditionen.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {data.konditionen.map((kondition) => (
            <div key={kondition.id} className="p-4 border rounded-lg space-y-4">
              {/* Name & Einheit Row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>{t('dimensionen.konditionen.name')}</Label>
                  <Input
                    value={kondition.name}
                    onChange={(e) => updateKondition(kondition.id, { name: e.target.value })}
                    placeholder={t('dimensionen.konditionen.namePlaceholder')}
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('dimensionen.konditionen.einheit')}</Label>
                  <Input
                    value={kondition.einheit}
                    onChange={(e) => updateKondition(kondition.id, { einheit: e.target.value })}
                    placeholder={t('dimensionen.konditionen.einheitPlaceholder')}
                  />
                </div>
              </div>

              {/* Werte Row */}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>{t('dimensionen.konditionen.minWert')}</Label>
                  <Input
                    type="number"
                    value={kondition.minWert || ''}
                    onChange={(e) =>
                      updateKondition(kondition.id, { minWert: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('dimensionen.konditionen.zielWert')}</Label>
                  <Input
                    type="number"
                    value={kondition.zielWert || ''}
                    onChange={(e) =>
                      updateKondition(kondition.id, { zielWert: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0"
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t('dimensionen.konditionen.maxWert')}</Label>
                  <Input
                    type="number"
                    value={kondition.maxWert || ''}
                    onChange={(e) =>
                      updateKondition(kondition.id, { maxWert: parseFloat(e.target.value) || 0 })
                    }
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Priorität & Remove Row */}
              <div className="flex items-end gap-4">
                <div className="flex-1 space-y-2">
                  <Label>{t('dimensionen.konditionen.priorität')}</Label>
                  <Select
                    value={kondition.priorität.toString()}
                    onValueChange={(value) =>
                      updateKondition(kondition.id, { priorität: parseInt(value) as 1 | 2 | 3 })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">{t('dimensionen.konditionen.mustHave')}</SelectItem>
                      <SelectItem value="2">{t('dimensionen.konditionen.important')}</SelectItem>
                      <SelectItem value="3">{t('dimensionen.konditionen.flexible')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => removeKondition(kondition.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  {t('dimensionen.konditionen.remove')}
                </Button>
              </div>
            </div>
          ))}

          {/* Add Kondition Button */}
          <Button
            type="button"
            variant="outline"
            onClick={addKondition}
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            {t('dimensionen.konditionen.add')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
