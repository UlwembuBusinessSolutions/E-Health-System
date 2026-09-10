import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "@/auth/AuthContext";
import { PlatformAuthProvider } from "@/platform/PlatformAuthContext";
import { ToastProvider } from "@/shared/components/toast/ToastProvider";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <BrowserRouter>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <PlatformAuthProvider>
            <ToastProvider>{children}</ToastProvider>
          </PlatformAuthProvider>
        </AuthProvider>
      </QueryClientProvider>
    </BrowserRouter>
  );
}
