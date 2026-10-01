export type IdentityVerificationReason =
  | "CAPTURE_FAILED"
  | "NO_MATCH"
  | "DEVICE_FAULTY"
  | "DEVICE_UNAVAILABLE"
  | "OTHER";

export const IDENTITY_VERIFICATION_REASON_OPTIONS: { value: IdentityVerificationReason; label: string }[] = [
  { value: "CAPTURE_FAILED", label: "Biometric capture failed" },
  { value: "NO_MATCH", label: "Biometric matching failed" },
  { value: "DEVICE_FAULTY", label: "Biometric device is faulty" },
  { value: "DEVICE_UNAVAILABLE", label: "Biometric device is unavailable" },
  { value: "OTHER", label: "Other reason" },
];
