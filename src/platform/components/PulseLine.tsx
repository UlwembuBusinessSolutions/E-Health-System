// A generated EKG waveform, not hand-authored path data — one "blip" unit
// (flat → small bump → sharp spike → sharp drop → flat) tiled across the
// width. Decorative background texture for PlatformLoginScreen: a
// heartbeat reads as "health platform" without literally being a stock
// photo of a clinician, and doubles as "live signal" — apt for the one
// screen that's about to hand you a system-status dashboard.
const UNIT: [number, number][] = [
  [0, 0],
  [14, 0],
  [18, -3],
  [22, 0],
  [26, 1],
  [29, -26],
  [32, 20],
  [35, 0],
  [40, 0],
  [56, 0],
];
const UNIT_WIDTH = 56;

export function PulseLine({ className, repeats = 12 }: { className?: string; repeats?: number }) {
  const height = 56;
  const midline = height / 2;
  const points = Array.from({ length: repeats }, (_, i) =>
    UNIT.map(([x, y]) => `${x + i * UNIT_WIDTH},${y + midline}`).join(" "),
  ).join(" ");

  return (
    <svg
      viewBox={`0 0 ${UNIT_WIDTH * repeats} ${height}`}
      preserveAspectRatio="none"
      className={className}
      aria-hidden
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
