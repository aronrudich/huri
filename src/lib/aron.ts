/**
 * Support identity is separate from private GPS experimentation access.
 */
export const ARON_EMAILS = ["aron@huri.team", "aron@oremor.net"];
export const GPS_AUTHORIZED_EMAILS = [...ARON_EMAILS, "tristan4par@yahoo.com"];

export const isGpsAuthorizedEmail = (email: string | null | undefined) =>
  GPS_AUTHORIZED_EMAILS.includes((email ?? "").toLowerCase());

export const isAronEmail = (email: string | null | undefined) =>
  ARON_EMAILS.includes((email ?? "").toLowerCase());
