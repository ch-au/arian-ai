import { createContext, useContext, useState, ReactNode } from 'react';

interface NegotiationContextType {
  selectedNegotiationId: string | null;
  setSelectedNegotiationId: (id: string | null) => void;
}

const NegotiationContext = createContext<NegotiationContextType | undefined>(undefined);

export function NegotiationProvider({ children }: { children: ReactNode }) {
  const [selectedNegotiationId, setSelectedNegotiationId] = useState<string | null>(null);

  return (
    <NegotiationContext.Provider value={{ selectedNegotiationId, setSelectedNegotiationId }}>
      {children}
    </NegotiationContext.Provider>
  );
}

export function useNegotiationContext() {
  const context = useContext(NegotiationContext);
  if (context === undefined) {
    throw new Error('useNegotiationContext must be used within a NegotiationProvider');
  }
  return context;
}
