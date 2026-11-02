import { expect, mock, test } from "bun:test";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

mock.module("./push-server.server", () => ({ sendWebPush: async () => {}, isStalePushStatus: () => false, isBadSubscriptionStatus: () => false }));
const { createPickupAndNotify } = await import("./pickup-notifications.server");
const pin = { latitude: 34.123, longitude: -117.456, accuracy_ft: 18, pinned_at: "2026-11-02T02:00:00Z" };

function clientFor(car: Record<string, unknown> | null) {
  const reads: { table: string; filters: Record<string, unknown> }[] = [];
  const inserts: Record<string, unknown>[] = [];
  const client = { from(table: string) {
    const filters: Record<string, unknown> = {};
    const builder = {
      select() { return builder; },
      eq(key: string, value: unknown) { filters[key] = value; return builder; },
      order() { return builder; }, limit() { return builder; },
      insert(values: Record<string, unknown>) { inserts.push(values); return builder; },
      async maybeSingle() {
        reads.push({ table, filters });
        return { data: table === "profiles" ? { dealership_id: "company-a", role_name: "Admin", is_active: true, status: "approved", email: "aron@huri.team" } : car, error: null };
      },
      async single() { return { data: table === "dealerships" ? { ro_format: "digits_6" } : { id: "request" }, error: null }; },
    };
    return builder;
  } } as unknown as SupabaseClient<Database>;
  return { client, reads, inserts };
}

for (const kind of ["pickup", "park", "wash", "parts"] as const) {
  test(`${kind} request preserves all four saved GPS fields through a company-scoped lookup`, async () => {
    const s = clientFor({ lot_position: "GPS PIN", ...pin });
    await createPickupAndNotify(s.client, "aron", { ro: "000006", kind, isTest: true });
    expect(s.reads.find((read) => read.table === "parked_cars")?.filters).toEqual({ dealership_id: "company-a", ro_number: "000006" });
    expect(s.inserts).toHaveLength(1);
    expect(s.inserts[0]).toMatchObject({ kind, ro_number: "000006", is_test: true, ...pin });
  });
}

test("a car without coordinates does not get invented GPS fields", async () => {
  const s = clientFor({ lot_position: "SV 3", latitude: null, longitude: null, accuracy_ft: null, pinned_at: null });
  await createPickupAndNotify(s.client, "aron", { ro: "000006", kind: "wash", isTest: true });
  expect(s.inserts[0]).not.toHaveProperty("latitude");
  expect(s.inserts[0]).not.toHaveProperty("longitude");
});