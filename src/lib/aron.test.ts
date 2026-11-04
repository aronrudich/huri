import { expect, test } from "bun:test";
import { isAronEmail, isGpsAuthorizedEmail } from "./aron";

test("Tristan has private GPS access but never Support identity", () => {
  expect(isGpsAuthorizedEmail("tristan4par@yahoo.com")).toBe(true);
  expect(isGpsAuthorizedEmail("TRISTAN4PAR@YAHOO.COM")).toBe(true);
  expect(isAronEmail("tristan4par@yahoo.com")).toBe(false);
});
test("both Aron identities retain GPS and Support access", () => {
  for (const email of ["aron@huri.team", "aron@oremor.net"]) {
    expect(isGpsAuthorizedEmail(email)).toBe(true);
    expect(isAronEmail(email)).toBe(true);
  }
});
test("unknown and absent identities cannot use private GPS", () => {
  for (const email of ["employee@example.com", "tristan4par@yahoo.com.evil", "", null, undefined]) {
    expect(isGpsAuthorizedEmail(email)).toBe(false);
  }
});