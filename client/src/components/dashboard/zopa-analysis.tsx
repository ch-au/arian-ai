import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";

export default function ZopaAnalysis() {
  // Mock ZOPA data for demonstration - in real app this would come from API
  const [zopaData] = useState({
    volume: {
      overlap: "strong" as const,
      overlapRange: { min: 2000, max: 4000 },
      buyerRange: { min: 1000, max: 5000 },
      sellerRange: { min: 1500, max: 4500 }
    },
    price: {
      overlap: "narrow" as const,
      overlapRange: { min: 12, max: 13 },
      buyerRange: { min: 10, max: 20 },
      sellerRange: { min: 11, max: 15 }
    },
    paymentTerms: {
      overlap: "strong" as const,
      overlapRange: { min: 45, max: 50 },
      buyerRange: { min: 30, max: 60 },
      sellerRange: { min: 40, max: 55 }
    },
    recommendation: "Focus negotiations on volume and payment terms where there's strong overlap. Price may require creative solutions."
  });

  const getOverlapIcon = (overlap: string) => {
    switch (overlap) {
      case "strong":
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case "narrow":
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case "weak":
        return <TrendingUp className="w-4 h-4 text-orange-600" />;
      default:
        return <AlertTriangle className="w-4 h-4 text-red-600" />;
    }
  };

  const getOverlapColor = (overlap: string) => {
    switch (overlap) {
      case "strong":
        return "text-green-600";
      case "narrow":
        return "text-yellow-600";
      case "weak":
        return "text-orange-600";
      default:
        return "text-red-600";
    }
  };

  const getOverlapBadgeVariant = (overlap: string) => {
    switch (overlap) {
      case "strong":
        return "default";
      case "narrow":
        return "secondary";
      case "weak":
        return "outline";
      default:
        return "destructive";
    }
  };

  const renderZopaBar = (data: any, unit: string) => {
    const totalRange = Math.max(data.buyerRange.max, data.sellerRange.max) - Math.min(data.buyerRange.min, data.sellerRange.min);
    
    const buyerStart = ((data.buyerRange.min - Math.min(data.buyerRange.min, data.sellerRange.min)) / totalRange) * 100;
    const buyerWidth = ((data.buyerRange.max - data.buyerRange.min) / totalRange) * 100;
    
    const sellerStart = ((data.sellerRange.min - Math.min(data.buyerRange.min, data.sellerRange.min)) / totalRange) * 100;
    const sellerWidth = ((data.sellerRange.max - data.sellerRange.min) / totalRange) * 100;
    
    const overlapStart = data.overlapRange ? ((data.overlapRange.min - Math.min(data.buyerRange.min, data.sellerRange.min)) / totalRange) * 100 : 0;
    const overlapWidth = data.overlapRange ? ((data.overlapRange.max - data.overlapRange.min) / totalRange) * 100 : 0;

    return (
      <div className="relative">
        <div className="w-full h-6 bg-gray-200 rounded-full relative overflow-hidden">
          {/* Buyer range */}
          <div 
            className="absolute h-3 bg-blue-200 rounded-full top-0"
            style={{ left: `${buyerStart}%`, width: `${buyerWidth}%` }}
          />
          {/* Seller range */}
          <div 
            className="absolute h-3 bg-purple-200 rounded-full bottom-0"
            style={{ left: `${sellerStart}%`, width: `${sellerWidth}%` }}
          />
          {/* Overlap */}
          {data.overlapRange && (
            <div 
              className={`absolute h-6 rounded-full ${
                data.overlap === 'strong' ? 'bg-green-500' :
                data.overlap === 'narrow' ? 'bg-yellow-500' : 'bg-orange-500'
              }`}
              style={{ left: `${overlapStart}%`, width: `${overlapWidth}%` }}
            />
          )}
        </div>
        <div className="flex justify-between text-xs text-gray-500 mt-1">
          <span>{Math.min(data.buyerRange.min, data.sellerRange.min)}{unit}</span>
          {data.overlapRange && (
            <span className="font-medium">
              Overlap: {data.overlapRange.min}-{data.overlapRange.max}{unit}
            </span>
          )}
          <span>{Math.max(data.buyerRange.max, data.sellerRange.max)}{unit}</span>
        </div>
      </div>
    );
  };

  return (
    <Card>
      <CardHeader className="border-b border-gray-200">
        <CardTitle className="text-lg font-semibold text-gray-900">ZOPA Analysis</CardTitle>
        <p className="text-sm text-gray-500 mt-1">Zone of Possible Agreement insights</p>
      </CardHeader>
      <CardContent className="p-6">
        <div className="space-y-6">
          {/* Volume ZOPA */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Volume Range</span>
              <div className="flex items-center space-x-2">
                {getOverlapIcon(zopaData.volume.overlap)}
                <Badge variant={getOverlapBadgeVariant(zopaData.volume.overlap)} className="text-xs">
                  {zopaData.volume.overlap.charAt(0).toUpperCase() + zopaData.volume.overlap.slice(1)} Overlap
                </Badge>
              </div>
            </div>
            {renderZopaBar(zopaData.volume, " units")}
          </div>

          {/* Price ZOPA */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Price Range</span>
              <div className="flex items-center space-x-2">
                {getOverlapIcon(zopaData.price.overlap)}
                <Badge variant={getOverlapBadgeVariant(zopaData.price.overlap)} className="text-xs">
                  {zopaData.price.overlap.charAt(0).toUpperCase() + zopaData.price.overlap.slice(1)} Overlap
                </Badge>
              </div>
            </div>
            {renderZopaBar(zopaData.price, "/unit")}
          </div>

          {/* Payment Terms */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-900">Payment Terms</span>
              <div className="flex items-center space-x-2">
                {getOverlapIcon(zopaData.paymentTerms.overlap)}
                <Badge variant={getOverlapBadgeVariant(zopaData.paymentTerms.overlap)} className="text-xs">
                  {zopaData.paymentTerms.overlap.charAt(0).toUpperCase() + zopaData.paymentTerms.overlap.slice(1)} Overlap
                </Badge>
              </div>
            </div>
            {renderZopaBar(zopaData.paymentTerms, " days")}
          </div>
        </div>

        <div className="mt-6 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-start space-x-3">
            <Lightbulb className="text-blue-600 mt-0.5 w-4 h-4" />
            <div>
              <p className="text-sm font-medium text-blue-900">ZOPA Recommendation</p>
              <p className="text-sm text-blue-700 mt-1">{zopaData.recommendation}</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
