export const SCAN_FREQUENCIES = [
  { value: "15min", label: "Every 15 minutes" },
  { value: "30min", label: "Every 30 minutes" },
  { value: "hourly", label: "Hourly" },
  { value: "6h", label: "Every 6 hours" },
  { value: "12h", label: "Every 12 hours" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
] as const;

export type ScanFrequency = (typeof SCAN_FREQUENCIES)[number]["value"];

export const SCAN_FREQUENCY_MS: Record<ScanFrequency, number> = {
  "15min": 15 * 60 * 1000,
  "30min": 30 * 60 * 1000,
  hourly: 60 * 60 * 1000,
  "6h": 6 * 60 * 60 * 1000,
  "12h": 12 * 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
  biweekly: 14 * 24 * 60 * 60 * 1000,
  monthly: 30 * 24 * 60 * 60 * 1000,
};

export function scanFrequencyLabel(value: string): string {
  return SCAN_FREQUENCIES.find((f) => f.value === value)?.label ?? value;
}

export function isScanFrequency(value: string): value is ScanFrequency {
  return value in SCAN_FREQUENCY_MS;
}
