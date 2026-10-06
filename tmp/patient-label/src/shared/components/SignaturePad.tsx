import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Eraser } from "lucide-react";

interface SignaturePadProps {
  onChange: (signature: Blob | null) => void;
  disabled?: boolean;
}

// A guardian's consent-to-act signature — drawn with mouse/touch/pen via
// the Pointer Events API (one handler set for all three input kinds,
// rather than separate mouse/touch listeners). Exports a PNG blob on every
// stroke-end; nothing is staged until the caller actually needs it
// (RegisterPatientScreen holds it in state the same way it holds a picked
// document file, right up until the guardian record itself exists).
export function SignaturePad({ onChange, disabled }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  // Backing store scaled to devicePixelRatio so the stroke stays crisp on
  // high-DPI screens; the 2D context is then scaled right back down so
  // every other coordinate in this file can stay in plain CSS-pixel units.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
  }, []);

  const point = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const start = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    drawingRef.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const move = (e: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.strokeStyle = "#1f2937";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasDrawn(true);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    canvasRef.current?.toBlob((blob) => onChange(blob), "image/png");
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    onChange(null);
  };

  return (
    <div className="flex flex-col gap-1.5">
      <div className="relative h-28 w-full overflow-hidden rounded-lg border border-dashed border-border-strong bg-surface-sunken/60">
        <canvas
          ref={canvasRef}
          className="size-full touch-none"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
        />
        {!hasDrawn && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] text-text-secondary">
            Sign here to consent to act on the patient's behalf
          </p>
        )}
      </div>
      {hasDrawn && (
        <button
          type="button"
          onClick={clear}
          disabled={disabled}
          className="inline-flex w-fit items-center gap-1 text-[12px] font-medium text-text-secondary transition-colors duration-150 hover:text-danger-600"
        >
          <Eraser className="size-3.5" aria-hidden />
          Clear signature
        </button>
      )}
    </div>
  );
}
