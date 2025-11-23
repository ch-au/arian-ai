import { StackClientApp } from '@stackframe/react';
import { useLocation } from "wouter";

function useWouterNavigate() {
  const [, setLocation] = useLocation();
  return (to: string) => setLocation(to);
}

// Debug logging
console.log("Stack Config:", {
  projectId: import.meta.env.VITE_STACK_PROJECT_ID,
  publishableClientKey: import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY
});

export const stackClientApp = new StackClientApp({
  projectId: (import.meta.env.VITE_STACK_PROJECT_ID as string) || "e411fb38-3279-4d84-80bc-6cbb1ecc31cd",
  publishableClientKey: (import.meta.env.VITE_STACK_PUBLISHABLE_CLIENT_KEY as string) || "pck_bfx0sqwbpk7pndhh9th0pf87ffhc05e361sv02319j7s0",
  tokenStore: 'cookie',
  redirectMethod: { useNavigate: useWouterNavigate },
});
