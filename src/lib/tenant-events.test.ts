import { describe, expect, it } from "vitest";
import { companyRoKey, isCompanyEvent } from "./tenant-events";

describe("company event isolation", () => {
  it("accepts only the current company's update", () => {
    expect(isCompanyEvent({ dealership_id: "A" }, "A")).toBe(true);
    expect(isCompanyEvent({ dealership_id: "B" }, "A")).toBe(false);
    expect(isCompanyEvent({}, "A")).toBe(false);
    expect(isCompanyEvent({ dealership_id: "A" }, null)).toBe(false);
  });
  it("keeps identical ROs in separate company histories", () => {
    expect(companyRoKey("A", "194000")).not.toBe(companyRoKey("B", "194000"));
  });
});