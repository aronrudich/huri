export type ServiceDay = { open: number; close: number } | null;
export type ServiceHours = ServiceDay[];
export const DEFAULT_SERVICE_HOURS: ServiceHours = [null, ...Array.from({ length: 5 }, () => ({ open: 390, close: 1080 })), { open: 480, close: 960 }];

export function parseServiceHours(value: unknown): ServiceHours {
  if (value === undefined || value === null) return DEFAULT_SERVICE_HOURS;
  if (!Array.isArray(value) || value.length !== 7) throw new Error("Invalid service hours");
  return value.map((day) => {
    if (day === null) return null;
    if (typeof day !== "object" || Array.isArray(day) || !Number.isInteger(day.open) || !Number.isInteger(day.close) || day.open < 0 || day.close > 1439 || day.open >= day.close) throw new Error("Invalid service hours");
    return { open: day.open, close: day.close };
  });
}

/**
 * Repair order formats are strictly numeric: "digits_1" … "digits_7".
 * Legacy values ("six_digits", "flexible") and anything unknown fall back to
 * the 6-digit standard so old company rows keep validating the same way.
 */
export const RO_FORMAT_OPTIONS = [
  { value: "digits_1", label: "1 digit" },
  { value: "digits_2", label: "2 digits" },
  { value: "digits_3", label: "3 digits" },
  { value: "digits_4", label: "4 digits" },
  { value: "digits_5", label: "5 digits" },
  { value: "digits_6", label: "6 digits" },
  { value: "digits_7", label: "7 digits" },
] as const;

export function roDigitLength(format?: string | null): number {
  const match = /^digits_([1-7])$/.exec(format ?? "");
  return match ? Number(match[1]) : 6;
}

export function isValidRo(ro: string, format?: string | null): boolean {
  const digits = roDigitLength(format);
  return new RegExp(`^\\d{${digits}}$`).test(ro.trim());
}

/** Numeric keyboard filter for RO inputs: digits only, capped at the company's length. */
export function filterRoInput(value: string, format?: string | null): string {
  return value.replace(/\D/g, "").slice(0, roDigitLength(format));
}

export function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}
