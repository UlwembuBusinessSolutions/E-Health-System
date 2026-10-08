import { TriangleAlert } from "lucide-react";
import { Button } from "@/shared/components/Button";

interface ErrorStateProps {
  /** Already user-readable — pass `describeError(error)`. */
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
}

export function ErrorState({ message, onRetry, retrying = false }: ErrorStateProps) {
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-5 py-10 text-center">
      <TriangleAlert className="size-6 text-danger-500" aria-hidden />
      <p className="max-w-sm text-[13.5px] text-text-secondary">{message}</p>
      {onRetry && (
        <Button variant="secondary" loading={retrying} onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}
