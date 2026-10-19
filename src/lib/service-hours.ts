export const SERVICE_CLOSED_MESSAGE = "We are sorry. The service department is closed at that time.";

/** Company wall-clock date and minute; the exact closing minute is allowed. */
export function isServiceTimeOpen(date: string, hour: number, minute: number, meridiem: "AM" | "PM"): boolean {
  const day = new Date(`${date}T12:00:00Z`);
  if (!Number.isFinite(day.getTime()) || day.toISOString().slice(0, 10) !== date) return false;
  if (!Number.isInteger(hour) || hour < 1 || hour > 12 || !Number.isInteger(minute) || minute < 0 || minute > 59) return false;
  const weekday = day.getUTCDay();
  if (weekday === 0) return false;
  const minutes = (hour % 12 + (meridiem === "PM" ? 12 : 0)) * 60 + minute;
  const opening = weekday === 6 ? 8 * 60 : 6 * 60 + 30;
  const closing = weekday === 6 ? 16 * 60 : 18 * 60;
  return minutes >= opening && minutes <= closing;
}

export function isServiceOpenAt(timeZone: string, at: Date): boolean {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "numeric", minute: "2-digit", hour12: true,
  }).formatToParts(at);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "";
  return isServiceTimeOpen(`${get("year")}-${get("month")}-${get("day")}`, Number(get("hour")), Number(get("minute")), get("dayPeriod") === "PM" ? "PM" : "AM");
}

export function requireServiceOpenAt(timeZone: string, at: Date): void {
  if (!isServiceOpenAt(timeZone, at)) throw new Error(SERVICE_CLOSED_MESSAGE);
}