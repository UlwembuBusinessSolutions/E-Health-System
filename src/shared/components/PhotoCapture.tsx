import { useEffect, useRef, useState, type ChangeEvent, type ComponentType } from "react";
import { Camera, Upload, User, X } from "lucide-react";
import { Button } from "./Button";

interface PhotoCaptureProps {
  file: File | null;
  onChange: (file: File | null) => void;
  disabled?: boolean;
  // Both default to the original staff-photo behaviour — a headshot has an
  // obvious camera use case; an organization logo doesn't (nobody
  // photographs their own logo with a webcam), so ProvisionOrganizationScreen
  // sets allowCamera={false} rather than this component growing a second,
  // near-duplicate implementation for that one difference.
  allowCamera?: boolean;
  placeholderIcon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  uploadLabel?: string;
  replaceLabel?: string;
}

// getUserMedia is undefined outright on insecure origins / browsers
// without camera support — checked once so the webcam button simply
// doesn't render there instead of throwing when clicked.
const CAMERA_SUPPORTED =
  typeof navigator !== "undefined" && !!navigator.mediaDevices?.getUserMedia;

// Used both on AddStaffScreen's create form (photo selected up front, sent
// right after the staff id comes back) and could be reused wherever a
// photo needs picking — file input or a live webcam snapshot, same output
// shape (a File) either way, so callers never need to know which one
// happened.
export function PhotoCapture({
  file,
  onChange,
  disabled,
  allowCamera = true,
  placeholderIcon: PlaceholderIcon = User,
  uploadLabel = "Upload photo",
  replaceLabel = "Replace photo",
}: PhotoCaptureProps) {
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Object URL preview — created per file, revoked on the next change or
  // unmount so selecting several photos in a row doesn't leak memory.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Camera stream itself — stopped on unmount regardless of how the
  // component leaves the camera-on state, so navigating away mid-capture
  // never leaves the camera light on.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };

  const startCamera = async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" } });
      streamRef.current = stream;
      setCameraOn(true);
      // video element only exists once cameraOn renders it — assign next tick.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch {
      setCameraError("Couldn't access the camera — check your browser's camera permission and try again.");
    }
  };

  const capture = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) onChange(new File([blob], "staff-photo.jpg", { type: "image/jpeg" }));
        stopCamera();
      },
      "image/jpeg",
      0.92,
    );
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (selected) onChange(selected);
  };

  if (cameraOn) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div className="w-full max-w-[280px] overflow-hidden rounded-xl border border-border-strong bg-black">
          {/* Mirrored for display only (feels like a mirror) — capture()
              draws from the underlying video stream, which isn't
              CSS-transformed, so the saved photo comes out un-mirrored. */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="aspect-square w-full -scale-x-100 object-cover"
          />
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <div className="flex gap-2">
          <Button type="button" variant="secondary" onClick={stopCamera}>
            Cancel
          </Button>
          <Button type="button" icon={<Camera className="size-4" aria-hidden />} onClick={capture}>
            Capture
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="flex size-24 items-center justify-center overflow-hidden rounded-full border border-dashed border-border-strong bg-surface-sunken text-text-secondary">
          {previewUrl ? (
            <img src={previewUrl} alt="" className="size-full object-cover" />
          ) : (
            <PlaceholderIcon className="size-8" aria-hidden />
          )}
        </div>
        {previewUrl && (
          <button
            type="button"
            onClick={() => onChange(null)}
            disabled={disabled}
            aria-label="Remove photo"
            className="absolute -right-1 -top-1 flex size-6 items-center justify-center rounded-full border border-border-strong bg-surface-raised text-text-secondary shadow-sm transition-colors duration-150 hover:bg-danger-50 hover:text-danger-600"
          >
            <X className="size-3.5" aria-hidden />
          </button>
        )}
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="secondary"
          disabled={disabled}
          icon={<Upload className="size-4" aria-hidden />}
          onClick={() => fileInputRef.current?.click()}
        >
          {previewUrl ? replaceLabel : uploadLabel}
        </Button>
        {allowCamera && CAMERA_SUPPORTED && (
          <Button
            type="button"
            variant="secondary"
            disabled={disabled}
            icon={<Camera className="size-4" aria-hidden />}
            onClick={startCamera}
          >
            Use webcam
          </Button>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={handleFileChange}
      />
      {cameraError && (
        <p role="alert" className="max-w-[280px] text-center text-[13px] text-danger-600">
          {cameraError}
        </p>
      )}
    </div>
  );
}
