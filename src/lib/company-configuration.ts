export type ServiceDay = { open: number; close: number } | null;
export type ServiceHours = ServiceDay[];
export const DEFAULT_SERVICE_HOURS: ServiceHours = [null, ...Array.from({ length: 5 }, () => ({ open: 390, close: 1080 })), { open: 480, close: 960 }];

export function parseServiceHours(value: unknown): ServiceHours {
  if (value === undefined || value === null) return DEFAULT_SERVICE_HOURS;
  if (!Array.isArray(value) || value.length !== 7) throw new Error("Invalid service hours");
  return value.map((day) => {
    if (day === null) return null;
    if (typeof day !== "object" || !Number.isInteger(day.open) || !Number.isInteger(day.close) || day.open < 0 || day.close > 1439 || day.open >= day.close) throw new Error("Invalid service hours");
    return { open: day.open, close: day.close };
  });
}

export function isValidRo(ro: string, format = "six_digits"): boolean {
  return (format === "flexible" ? /^[A-Za-z0-9_-]{3,10}$/ : /^\d{6}$/).test(ro.trim());
}

export function formatClock(minutes: number): string {
  const hour = Math.floor(minutes / 60);
  return `${hour % 12 || 12}:${String(minutes % 60).padStart(2, "0")} ${hour >= 12 ? "PM" : "AM"}`;
}