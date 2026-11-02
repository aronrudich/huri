import { expect, test } from "bun:test";
import {
  actionsForRole,
  canViewFlagged,
  canViewReports,
  canViewSettings,
  isManagementTitle,
  ROLE_OPTIONS,
  splitRolesByLevel,
} from "./roles";

test("management titles are exactly roles containing manager, director or admin", () => {
  for (const r of ["Admin", "Service Manager", "Service Director", "General Manager", "Manager", "Director", "Parts Manager", "Assistant Service Manager"]) {
    expect(isManagementTitle(r)).toBe(true);
  }
  for (const r of ["Valet", "Valet Supervisor", "Car Wash", "Advisor", "Technician", "Shop Foreman", "Spectator", "Other", "", null, undefined]) {
    expect(isManagementTitle(r)).toBe(false);
  }
});

test("settings, reports and flagged cars are limited to management titles and the owner", () => {
  for (const r of ["Valet", "Valet Supervisor", "Advisor", "Technician", "Shop Foreman", "Spectator", "Car Wash"]) {
    expect(canViewSettings(r)).toBe(false);
    expect(canViewReports(r)).toBe(false);
    expect(canViewFlagged(r)).toBe(false);
  }
  for (const r of ["Admin", "Service Manager", "Service Director", "General Manager", "Manager", "Director"]) {
    expect(canViewSettings(r)).toBe(true);
    expect(canViewReports(r)).toBe(true);
    expect(canViewFlagged(r)).toBe(true);
  }
  // The company owner always keeps access, whatever their title.
  expect(canViewSettings("Valet", true)).toBe(true);
  expect(canViewReports("Valet", true)).toBe(true);
  expect(canViewFlagged("Valet", true)).toBe(true);
});

test("regular employees never see settings, reports or flagged in the actions menu", () => {
  for (const r of ["Valet", "Advisor", "Technician", "Spectator"]) {
    const items = actionsForRole(r, { enable_wash: true, enable_parts: true, enable_staging: true });
    expect(items).not.toContain("settings");
    expect(items).not.toContain("reports");
    expect(items).not.toContain("flagged");
  }
  const mgr = actionsForRole("Service Manager", { enable_wash: true, enable_parts: true, enable_staging: true });
  expect(mgr).toContain("settings");
  expect(mgr).toContain("reports");
  expect(mgr).toContain("flagged");
});

test("role lists split regular roles first with management below the divider", () => {
  const { regular, management } = splitRolesByLevel([...ROLE_OPTIONS]);
  expect(regular).toEqual(["Valet", "Valet Supervisor", "Car Wash", "Advisor", "Technician", "Shop Foreman", "Spectator", "Other"]);
  expect(management).toEqual(["Service Manager", "Service Director", "General Manager", "Manager", "Director", "Admin"]);
  // The divider words are never labels: groups carry no names at all.
  expect([...regular, ...management]).not.toContain("employees");
});
