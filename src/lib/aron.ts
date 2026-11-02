/**
 * Aron's accounts are Huri's global administrator. Experimental controls
 * (GPS pin drop, satellite map, silent test submissions) are gated to these
 * emails only — every other account must see zero trace of them.
 */
export const ARON_EMAILS = ["aron@huri.team", "aron@oremor.net"];

export const isAronEmail = (email: string | null | undefined) =>
  ARON_EMAILS.includes((email ?? "").toLowerCase());
