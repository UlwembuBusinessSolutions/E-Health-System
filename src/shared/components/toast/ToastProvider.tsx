import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";
import clsx from "clsx";

type ToastVariant = "success" | "error" | "info";

interface ToastItem {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  showToast: (message: string, variant?: ToastVariant) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
  success: CheckCircle2,
  error: AlertCircle,
  info: Info,
};

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  success: "border-success-500/30 text-success-600 [&_svg]:text-success-500",
  error: "border-danger-500/30 text-danger-600 [&_svg]:text-danger-500",
  info: "border-brand-500/30 text-brand-600 [&_svg]:text-brand-500",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  // Slide-up + auto-dismiss, per the motion table: confirms an action
  // completed (e.g. "saved, will sync") without blocking the next one.
  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const id = ++idRef.current;
    setToasts((prev) => [...prev, { id, message, variant }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:bottom-6">
        <AnimatePresence>
          {toasts.map((toast) => {
            const Icon = ICONS[toast.variant];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
                transition={{ duration: 0.2 }}
                className={clsx(
                  "pointer-events-auto flex items-center gap-2.5 rounded-lg border bg-surface-raised px-4 py-3 text-[13.5px] font-medium shadow-card",
                  VARIANT_CLASSES[toast.variant],
                )}
              >
                <Icon className="size-4 shrink-0" aria-hidden />
                {toast.message}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
