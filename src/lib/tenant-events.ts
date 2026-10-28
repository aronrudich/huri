/** Missing tenant metadata is never trusted for an insert/update or alert. */
export function isCompanyEvent(row: unknown, companyId: string | null | undefined): boolean {
  return !!companyId && !!row && typeof row === "object" &&
    "dealership_id" in row && row.dealership_id === companyId;
}

export function companyRoKey(companyId: string, ro: string | null): string {
  return `${companyId}|${(ro ?? "").trim()}`;
}