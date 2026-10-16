/** Huri Support accounts. These addresses can never be created or confirmed through sign-up. */
export const SUPPORT_EMAILS = ["aron@huri.team", "aron@oremor.net"];
export const isReservedEmail = (email: string) => SUPPORT_EMAILS.includes(email.trim().toLowerCase());
