/** Submission-to-claim cutoff; operational records must never be removed. */
export const MAX_REPORT_CLAIM_MS = 8 * 60 * 60 * 1000;

type ReportRequest = {
  status: string;
  created_at: string;
  claimed_at: string | null;
};

export function isReportEligible(row: ReportRequest): boolean {
  if (["canceled", "cancelled", "picked_up"].includes(row.status)) return false;
  if (!row.claimed_at) return true;
  const elapsed = Date.parse(row.claimed_at) - Date.parse(row.created_at);
  // Preserve existing handling of malformed/negative timestamps as anomalies.
  return !(elapsed > MAX_REPORT_CLAIM_MS);
}