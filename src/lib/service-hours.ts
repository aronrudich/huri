export const SERVICE_CLOSED_MESSAGE = "We are sorry. The service department is closed at that time.";
import { parseServiceHours } from "./company-configuration";

/** Company wall-clock date and minute; the exact closing minute is allowed. */
export function isServiceTimeOpen(date: string, hour: number, minute: number, meridiem: "AM" | "PM", hours?: unknown): boolean {
  const day = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return false;
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) return false;
  const weekday = day.getUTCDay();
  const minutes = (hour % 12 + (meridiem === "PM" ? 12 : 0)) * 60 + minute;
  try {
    const dayHours = parseServiceHours(hours)[weekday];
    return !!dayHours && minutes >= dayHours.open && minutes <= dayHours.close;
  } catch { return false; }
}

export function isServiceOpenAt(timeZone: string, at: Date, hours?: unknown): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return isServiceTimeOpen(`${get("year")}-${get("month")}-${get("day")}`, Number(get("hour")), Number(get("minute")), get("dayPeriod") === "PM" ? "PM" : "AM", hours);
}

export function requireServiceOpenAt(timeZone: string, at: Date, hours?: unknown): void {
  if (!isServiceOpenAt(timeZone, at, hours)) throw new Error(SERVICE_CLOSED_MESSAGE);
}