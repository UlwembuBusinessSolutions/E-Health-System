interface SkeletonRowsProps {
  rows?: number;
}

// motion-safe: users who prefer reduced motion get static grey bars.
export function SkeletonRows({ rows = 5 }: SkeletonRowsProps) {
  return (
    <div role="status" aria-busy="true" aria-label="Loading" className="divide-y divide-border-subtle">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex items-center gap-4 px-5 py-4 motion-safe:animate-pulse">
          <div className="h-4 w-1/3 rounded bg-surface-sunken" />
          <div className="h-4 w-1/5 rounded bg-surface-sunken" />
          <div className="ml-auto h-4 w-12 rounded bg-surface-sunken" />
        </div>
      ))}
    </div>
  );
}
