export type LabelType = "numbers" | "letters" | "letters_numbers" | "none";

export type CompanyLot = {
  id: string;
  dealership_id: string;
  lot_name: string;
  label_type: LabelType;
  prefix: string | null;
  range_start: string | null;
  range_end: string | null;
  has_blocking: boolean;
  blocking_explanation: string | null;
};

export const LABEL_TYPE_OPTIONS: { value: LabelType; label: string }[] = [
  { value: "letters_numbers", label: "Letters and Numbers" },
  { value: "numbers", label: "Numbers only" },
  { value: "letters", label: "Letters only" },
  { value: "none", label: "None" },
];

/** Human-readable spot format, e.g. "SV 1–150", "Spots 1–125", "A–Z", "No labeled spots". */
export function describeLotLabels(l: Pick<CompanyLot, "label_type" | "prefix" | "range_start" | "range_end">) {
  if (l.label_type === "none") return "No labeled spots";
  const range = `${l.range_start ?? ""}–${l.range_end ?? ""}`;
  if (l.label_type === "letters_numbers") return `${(l.prefix ?? "").trim()} ${range}`.trim();
  if (l.label_type === "letters") return `Letters ${range}`;
  return `Spots ${range}`;
}

/** Returns an error message, or null when the lot form is valid. */
export function validateLot(l: Omit<CompanyLot, "id" | "dealership_id">): string | null {
  if (!l.lot_name.trim()) return "Enter a lot name.";
  if (l.label_type === "numbers" || l.label_type === "letters_numbers") {
    const a = Number(l.range_start), b = Number(l.range_end);
    if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < a) return "Enter a valid number range.";
    if (l.label_type === "letters_numbers" && !(l.prefix ?? "").trim()) return "Enter the prefix or letter.";
  }
  if (l.label_type === "letters") {
    const a = (l.range_start ?? "").trim().toUpperCase(), b = (l.range_end ?? "").trim().toUpperCase();
    if (!/^[A-Z]$/.test(a) || !/^[A-Z]$/.test(b) || b < a) return "Enter a valid letter range.";
  }
  if (l.has_blocking && !(l.blocking_explanation ?? "").trim()) return "Explain how cars get blocked.";
  return null;
}
