import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '@/pages/dashboard';
import type { ReactNode } from 'react';

const describeIfDom = typeof document === 'undefined' ? describe.skip : describe;

describeIfDom('Dashboard page', () => {
  const renderWithData = (options: {
    metrics?: any;
    successTrends?: any[];
    topAgents?: any[];
    negotiations?: any[];
    agents?: any[];
    contexts?: any[];
  }) => {
    const queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          retry: false,
          refetchOnWindowFocus: false,
        },
      },
    });

    if (options.metrics) {
      queryClient.setQueryData(['/api/dashboard/metrics'], options.metrics);
    }
    if (options.successTrends) {
      queryClient.setQueryData(['/api/dashboard/success-trends'], options.successTrends);
    }
    if (options.topAgents) {
      queryClient.setQueryData(['/api/dashboard/top-agents'], options.topAgents);
    }
    if (options.negotiations) {
      queryClient.setQueryData(['/api/negotiations'], options.negotiations);
    }
    if (options.agents) {
      queryClient.setQueryData(['/api/agents'], options.agents);
    }
    if (options.contexts) {
      queryClient.setQueryData(['/api/contexts'], options.contexts);
    }

    const wrapper = ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );

    return render(<Dashboard />, { wrapper });
  };

  it('renders metrics, trends, top agents and live negotiations from cached data', () => {
    renderWithData({
      metrics: {
        activeNegotiations: 3,
        successRate: 82.5,
        avgDuration: 12.3,
        apiCostToday: 4.56,
        recentTrend: {
          activeNegotiationsChange: 5,
          successRateChange: 2,
          avgDurationChange: -1,
          apiCostChange: -3,
        },
      },
      successTrends: [
        { date: '2024-01-01', successRate: 80 },
        { date: '2024-01-08', successRate: 84 },
      ],
      topAgents: [
        {
          agent: {
            id: 'agent-1',
            name: 'Negotiator One',
            personalityProfile: { agreeableness: 0.8, conscientiousness: 0.6, extraversion: 0.5, openness: 0.4, neuroticism: 0.2 },
          },
          successRate: 91,
          totalNegotiations: 12,
          avgResponseTime: 1200,
          totalApiCost: 12.34,
        },
      ],
      negotiations: [
        {
          id: 'neg-1',
          contextId: 'context-1',
          status: 'running',
          totalRounds: 2,
          maxRounds: 6,
          buyerAgentId: 'agent-1',
          sellerAgentId: 'agent-2',
        },
      ],
      agents: [
        { id: 'agent-1', name: 'Buyer Bot' },
        { id: 'agent-2', name: 'Seller Bot' },
      ],
      contexts: [
        { id: 'context-1', name: 'Enterprise SaaS Deal' },
      ],
    });

    expect(screen.getByText('Active Negotiations')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Negotiator One')).toBeInTheDocument();
    expect(screen.getByText('Enterprise SaaS Deal')).toBeInTheDocument();
    expect(screen.getByText('View All Negotiations')).toBeInTheDocument();
  });

  it('handles missing data gracefully', () => {
    renderWithData({});

    expect(screen.getByText('Active Negotiations')).toBeInTheDocument();
    expect(screen.getByText('No active negotiations')).toBeInTheDocument();
  });
});
