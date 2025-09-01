import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'wouter';
import Dashboard from '../../pages/dashboard';

// Mock the child components to isolate the Dashboard component
beforeEach(() => {
  vi.mock('@/components/dashboard/metrics-cards', () => ({
    default: () => <div data-testid="metrics-cards" />,
  }));
  vi.mock('@/components/dashboard/live-negotiations', () => ({
    default: () => <div data-testid="live-negotiations" />,
  }));
  vi.mock('@/components/dashboard/simulation-run-history', () => ({
    default: () => <div data-testid="simulation-run-history" />,
  }));
  vi.mock('@/components/dashboard/success-chart', () => ({
    default: () => <div data-testid="success-chart" />,
  }));
  vi.mock('@/components/dashboard/agent-performance', () => ({
    default: () => <div data-testid="agent-performance" />,
  }));
  vi.mock('@/components/dashboard/quick-actions', () => ({
    default: () => <div data-testid="quick-actions" />,
  }));
});

const queryClient = new QueryClient();

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  );
};

describe('Dashboard', () => {
  it('renders all dashboard components', () => {
    renderWithProviders(<Dashboard />);
    
    // Use queryByTestId to avoid throwing errors if components are conditionally rendered
    expect(screen.queryByTestId('metrics-cards')).not.toBeNull();
    expect(screen.queryByTestId('live-negotiations')).not.toBeNull();
    expect(screen.queryByTestId('simulation-run-history')).not.toBeNull();
    expect(screen.queryByTestId('success-chart')).not.toBeNull();
    expect(screen.queryByTestId('agent-performance')).not.toBeNull();
    expect(screen.queryByTestId('quick-actions')).not.toBeNull();
  });
});
