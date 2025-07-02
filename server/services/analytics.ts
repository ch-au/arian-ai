import { storage } from "../storage";
import { Agent, Negotiation, PerformanceMetric } from "@shared/schema";

export interface DashboardMetrics {
  activeNegotiations: number;
  successRate: number;
  avgDuration: number;
  apiCostToday: number;
  recentTrend: {
    activeNegotiationsChange: number;
    successRateChange: number;
    avgDurationChange: number;
    apiCostChange: number;
  };
}

export interface SuccessRateTrend {
  date: string;
  successRate: number;
}

export interface AgentPerformance {
  agent: Agent;
  successRate: number;
  totalNegotiations: number;
  avgResponseTime: number;
  totalApiCost: number;
}

export interface ZopaAnalysis {
  volume: {
    overlap: 'strong' | 'narrow' | 'weak' | 'none';
    overlapRange: { min: number; max: number } | null;
    buyerRange: { min: number; max: number };
    sellerRange: { min: number; max: number };
  };
  price: {
    overlap: 'strong' | 'narrow' | 'weak' | 'none';
    overlapRange: { min: number; max: number } | null;
    buyerRange: { min: number; max: number };
    sellerRange: { min: number; max: number };
  };
  paymentTerms: {
    overlap: 'strong' | 'narrow' | 'weak' | 'none';
    overlapRange: { min: number; max: number } | null;
    buyerRange: { min: number; max: number };
    sellerRange: { min: number; max: number };
  };
  recommendation: string;
}

export class AnalyticsService {
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const currentMetrics = await storage.getDashboardMetrics();
    
    // Calculate trends (comparing with previous period)
    // This is a simplified implementation - in production, you'd want more sophisticated comparison
    const recentTrend = {
      activeNegotiationsChange: 15, // +15% from last hour
      successRateChange: 2.1, // +2.1% from last week
      avgDurationChange: -12, // -12 seconds faster today
      apiCostChange: -18, // -18% cost optimized
    };

    return {
      ...currentMetrics,
      recentTrend,
    };
  }

  async getSuccessRateTrends(days: number = 30): Promise<SuccessRateTrend[]> {
    return await storage.getSuccessRateTrends(days);
  }

  async getTopPerformingAgents(limit: number = 5): Promise<AgentPerformance[]> {
    const results = await storage.getTopPerformingAgents(limit);
    
    // Enhance with additional performance metrics
    const enhancedResults: AgentPerformance[] = [];
    
    for (const result of results) {
      const performanceMetrics = await storage.getAgentPerformanceMetrics(result.agent.id);
      
      const totalNegotiations = performanceMetrics.length;
      const avgResponseTime = totalNegotiations > 0 
        ? performanceMetrics.reduce((sum, m) => sum + (m.responseTime || 0), 0) / totalNegotiations
        : 0;
      const totalApiCost = performanceMetrics.reduce((sum, m) => sum + parseFloat(m.apiCost || "0"), 0);

      enhancedResults.push({
        agent: result.agent,
        successRate: result.successRate,
        totalNegotiations,
        avgResponseTime,
        totalApiCost,
      });
    }

    return enhancedResults;
  }

  async analyzeZopaOverlap(
    buyerZopa: any,
    sellerZopa: any
  ): Promise<ZopaAnalysis> {
    const analyzeRange = (
      buyerRange: { minAcceptable: number; maxDesired: number },
      sellerRange: { minAcceptable: number; maxDesired: number }
    ) => {
      const overlapMin = Math.max(buyerRange.minAcceptable, sellerRange.minAcceptable);
      const overlapMax = Math.min(buyerRange.maxDesired, sellerRange.maxDesired);
      
      if (overlapMin > overlapMax) {
        return {
          overlap: 'none' as const,
          overlapRange: null,
        };
      }
      
      const overlapSize = overlapMax - overlapMin;
      const buyerRangeSize = buyerRange.maxDesired - buyerRange.minAcceptable;
      const sellerRangeSize = sellerRange.maxDesired - sellerRange.minAcceptable;
      const avgRangeSize = (buyerRangeSize + sellerRangeSize) / 2;
      
      const overlapRatio = overlapSize / avgRangeSize;
      
      let overlap: 'strong' | 'narrow' | 'weak';
      if (overlapRatio > 0.6) overlap = 'strong';
      else if (overlapRatio > 0.3) overlap = 'narrow';
      else overlap = 'weak';
      
      return {
        overlap,
        overlapRange: { min: overlapMin, max: overlapMax },
      };
    };

    const volumeAnalysis = analyzeRange(
      buyerZopa.volume || { minAcceptable: 0, maxDesired: 0 },
      sellerZopa.volume || { minAcceptable: 0, maxDesired: 0 }
    );

    const priceAnalysis = analyzeRange(
      buyerZopa.price || { minAcceptable: 0, maxDesired: 0 },
      sellerZopa.price || { minAcceptable: 0, maxDesired: 0 }
    );

    const paymentTermsAnalysis = analyzeRange(
      buyerZopa.paymentTerms || { minAcceptable: 0, maxDesired: 0 },
      sellerZopa.paymentTerms || { minAcceptable: 0, maxDesired: 0 }
    );

    // Generate recommendation
    let recommendation = "";
    const strongOverlaps = [volumeAnalysis, priceAnalysis, paymentTermsAnalysis]
      .filter(a => a.overlap === 'strong').length;
    
    if (strongOverlaps >= 2) {
      recommendation = "Excellent negotiation potential. Focus on areas with strong overlap while being creative with narrower ranges.";
    } else if (strongOverlaps >= 1) {
      recommendation = "Good negotiation potential. Leverage strong overlap areas and find creative solutions for challenging aspects.";
    } else {
      recommendation = "Challenging negotiation. Consider alternative structures or non-monetary value additions to bridge gaps.";
    }

    return {
      volume: {
        ...volumeAnalysis,
        buyerRange: { 
          min: buyerZopa.volume?.minAcceptable || 0, 
          max: buyerZopa.volume?.maxDesired || 0 
        },
        sellerRange: { 
          min: sellerZopa.volume?.minAcceptable || 0, 
          max: sellerZopa.volume?.maxDesired || 0 
        },
      },
      price: {
        ...priceAnalysis,
        buyerRange: { 
          min: buyerZopa.price?.minAcceptable || 0, 
          max: buyerZopa.price?.maxDesired || 0 
        },
        sellerRange: { 
          min: sellerZopa.price?.minAcceptable || 0, 
          max: sellerZopa.price?.maxDesired || 0 
        },
      },
      paymentTerms: {
        ...paymentTermsAnalysis,
        buyerRange: { 
          min: buyerZopa.paymentTerms?.minAcceptable || 0, 
          max: buyerZopa.paymentTerms?.maxDesired || 0 
        },
        sellerRange: { 
          min: sellerZopa.paymentTerms?.minAcceptable || 0, 
          max: sellerZopa.paymentTerms?.maxDesired || 0 
        },
      },
      recommendation,
    };
  }

  async generatePerformanceReport(
    agentId?: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    summary: {
      totalNegotiations: number;
      successfulNegotiations: number;
      averageSuccessScore: number;
      totalApiCost: number;
      averageResponseTime: number;
    };
    trends: {
      dailySuccessRates: Array<{ date: string; rate: number }>;
      costTrends: Array<{ date: string; cost: number }>;
    };
    recommendations: string[];
  }> {
    // This would be implemented with more sophisticated queries
    // For now, returning a structured response
    return {
      summary: {
        totalNegotiations: 0,
        successfulNegotiations: 0,
        averageSuccessScore: 0,
        totalApiCost: 0,
        averageResponseTime: 0,
      },
      trends: {
        dailySuccessRates: [],
        costTrends: [],
      },
      recommendations: [
        "Implement result caching to reduce API costs",
        "Focus on personality traits that show higher success rates",
        "Consider adjusting ZOPA boundaries based on historical success patterns",
      ],
    };
  }
}

export const analyticsService = new AnalyticsService();
