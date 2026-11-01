import { describe, expect, test } from "bun:test";
import { describeLotLabels, validateLot } from "./company-lots";
import { customerArrivalTemplate } from "./arrive-link";

const base = { lot_name: "Back Lot", label_type: "numbers" as const, prefix: null, range_start: "1", range_end: "125", has_blocking: false, blocking_explanation: null };

describe("company lots", () => {
  test("blocking Yes requires an explanation", () => {
    expect(validateLot({ ...base, has_blocking: true, blocking_explanation: " " })).toBe("Explain how cars get blocked.");
    expect(validateLot({ ...base, has_blocking: true, blocking_explanation: "1-20 block 21-40" })).toBeNull();
  });
  test("letters and numbers needs a prefix", () => {
    expect(validateLot({ ...base, label_type: "letters_numbers" })).toBe("Enter the prefix or letter.");
    expect(describeLotLabels({ label_type: "letters_numbers", prefix: "SV", range_start: "1", range_end: "150" })).toBe("SV 1–150");
  });
  test("arrival template ends at ?ro=", () => {
    expect(customerArrivalTemplate("ontario")).toBe("https://huri.team/arrive/ontario?ro=");
  });
});
