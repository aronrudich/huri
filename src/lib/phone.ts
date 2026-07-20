// Phone number helpers. We store numbers in E.164 (e.g. +12135550132).
// Display format is US-friendly: (213) 555-0132.
// Signup/login use a synthetic email <digits>@huri.local behind the scenes so
// Supabase auth (which requires an email) still works — the email is never
// shown to the user.

export const HURI_EMAIL_DOMAIN = "huri.local";

/** Return only the digits from an input. */
export function digitsOnly(raw: string): string {
  return (raw ?? "").replace(/\D+/g, "");
}

/** Normalize any user-typed phone number to E.164, or null if invalid. */
export function normalizePhone(raw: string | null | undefined): string | null {
  const d = digitsOnly(raw ?? "");
  if (d.length === 10) return `+1${d}`;
  if (d.length === 11 && d.startsWith("1")) return `+${d}`;
  if (d.length >= 8 && d.length <= 15) return `+${d}`;
  return null;
}

/** Format an E.164 phone number for display. Falls back to the raw string. */
export function formatPhone(raw: string | null | undefined): string {
  if (!raw) return "";
  const d = digitsOnly(raw);
  if (d.length === 11 && d.startsWith("1")) {
    return `(${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  }
  if (d.length === 10) {
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  return raw;
}

/** Turn a phone number into the synthetic email we store in auth.users. */
export function phoneToSyntheticEmail(phone: string): string {
  const d = digitsOnly(phone);
  return `${d}@${HURI_EMAIL_DOMAIN}`;
}

/** Detect our synthetic emails so profile screens can hide them. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${HURI_EMAIL_DOMAIN}`);
}
