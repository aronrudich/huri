import { expect, mock, test } from "bun:test";
mock.module("@tanstack/react-start", () => ({ createServerFn: () => { const b = { middleware: () => b, inputValidator: () => b, handler: (fn: unknown) => fn }; return b; } }));
mock.module("@/integrations/supabase/auth-middleware", () => ({ requireSupabaseAuth: {} }));
let writes: { values: unknown; id?: string }[] = [];
const companyId = "7177fe1b-7188-496c-9ee5-a16e54ce5bbe";
mock.module("@/integrations/supabase/client.server", () => ({ supabaseAdmin: { from(table: string) {
  let write: { values: unknown; id?: string } | undefined;
  const b = { select: () => b, eq: (_key: string, value: string) => { if (write) write.id = value; return b; },
    update: (values: unknown) => { write = { values }; writes.push(write); return b; },
    single: async () => ({ data: table === "dealerships" ? { id: companyId } : null, error: null }),
    then: (resolve: (value: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve) };
  return b;
} } }));
const { switchActiveDealership } = await import("./dealership-switch.functions");
const run = switchActiveDealership as unknown as (args: unknown) => Promise<unknown>;
function context(email: string, status = "approved", role = "Admin", confirmed = true) {
  const b = { select: () => b, eq: () => b, single: async () => ({ data: { status, is_active: true, role_name: role }, error: null }) };
  return { userId: "caller", supabase: { auth: { getUser: async () => ({ data: { user: { id: "caller", email, email_confirmed_at: confirmed ? "2026-01-01" : null } }, error: null }) }, from: () => b } };
}
test("only confirmed approved Aron's identities can switch", async () => {
  writes = [];
  for (const c of [context("manager@example.com"), context("aron@huri.team", "pending"), context("aron@huri.team", "approved", "Spectator"), context("aron@huri.team", "approved", "Admin", false)]) {
    await expect(run({ context: c, data: { dealershipId: companyId } })).rejects.toThrow();
  }
  expect(writes).toHaveLength(0);
});
test("switch updates only authenticated caller's company and no privileges", async () => {
  writes = [];
  expect(await run({ context: context("aron@oremor.net"), data: { dealershipId: companyId } })).toEqual({ dealershipId: companyId });
  expect(writes).toEqual([{ values: { dealership_id: companyId }, id: "caller" }]);
});