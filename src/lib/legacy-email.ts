// Some legacy accounts were created with a synthetic internal email address.
// These helpers let profile screens hide those instead of showing them.

export const HURI_EMAIL_DOMAIN = "huri.local";

/** Detect our synthetic emails so profile screens can hide them. */
export function isSyntheticEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${HURI_EMAIL_DOMAIN}`);
}
