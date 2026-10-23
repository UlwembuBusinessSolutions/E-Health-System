import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  clearPatientAuth,
  getCurrentPatientAccount,
  getPatientToken,
  type PatientAccountSummary,
} from "@/shared/api/patientAuth";

// Mirrors auth/AuthContext.tsx exactly, for the patient portal's own
// identity — a separate context so a patient session and a staff session
// can never be confused with one another, same separation the backend
// keeps (PatientJwtAuthenticationFilter's own X-Patient-Key header, not
// staff's Authorization: Bearer).
interface PatientAuthContextValue {
  account: PatientAccountSummary | null;
  isInitializing: boolean;
  setAccount: (account: PatientAccountSummary | null) => void;
  logout: () => void;
}

const PatientAuthContext = createContext<PatientAuthContextValue | null>(null);

export function PatientAuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<PatientAccountSummary | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!getPatientToken()) {
      setIsInitializing(false);
      return;
    }
    getCurrentPatientAccount()
      .then((rehydrated) => {
        if (!cancelled) setAccount(rehydrated);
      })
      .catch(() => {
        clearPatientAuth();
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<PatientAuthContextValue>(
    () => ({
      account,
      isInitializing,
      setAccount,
      logout: () => {
        clearPatientAuth();
        setAccount(null);
      },
    }),
    [account, isInitializing],
  );

  return <PatientAuthContext.Provider value={value}>{children}</PatientAuthContext.Provider>;
}

export function usePatientAuth(): PatientAuthContextValue {
  const ctx = useContext(PatientAuthContext);
  if (!ctx) throw new Error("usePatientAuth must be used within PatientAuthProvider");
  return ctx;
}
