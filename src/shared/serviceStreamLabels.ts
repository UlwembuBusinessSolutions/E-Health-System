import type { ServiceStream } from "./api/visits";

export const SERVICE_STREAM_OPTIONS: { value: ServiceStream; label: string }[] = [
  { value: "GENERAL", label: "General / acute care" },
  { value: "CHRONIC_CARE", label: "Chronic care" },
  { value: "MATERNAL_CHILD", label: "Maternal & child health" },
  { value: "OCCUPATIONAL_HEALTH", label: "Occupational health" },
];

export const SERVICE_STREAM_LABELS: Record<ServiceStream, string> = Object.fromEntries(
  SERVICE_STREAM_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ServiceStream, string>;