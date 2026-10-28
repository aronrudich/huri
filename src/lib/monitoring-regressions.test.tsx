import { expect, mock, test } from "bun:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// Mount the real screens with controlled query/network boundaries, no live writes.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const user = { id: "valet" };
let profile = { dealership_id: "company", role_name: "Valet" };
let search: { id?: string; ro?: string; from?: string } = { id: "car", from: "flagged" };
let generation = 0;
let taken: unknown[] | undefined;
let requests: unknown[] = [];
const car = { id: "car", ro_number: "193626", car_model: "Jeep GC", notes: "Key inside", lot_position: "SV 3" };
let cached: unknown[] = [car];
const invalidations: unknown[] = [];
const writes: Record<string, unknown>[] = [];
let loadCount = 0;
let resolveLoad: ((value: unknown) => void) | undefined;
const client = {
  getQueryData: () => cached,
  setQueryData: (_key: unknown, update: unknown) => {
    if (typeof update === "function") update([]);
  },
  invalidateQueries: async (key: unknown) => { invalidations.push(key); },
};
type Channel = { name: string; handlers: Record<string, (p: unknown) => void>; status?: (s: string) => void; on: (...args: any[]) => Channel; subscribe: (fn: (s: string) => void) => Channel };
const channels: Channel[] = [];
const statuses: string[] = [];
mock.module("@/integrations/supabase/client", () => ({ supabase: {
  channel: (name: string) => {
    const channel: Channel = { name, handlers: {},
      on: (_event, config, fn) => { channel.handlers[config.table] = fn; return channel; },
      subscribe: (fn) => { channel.status = fn; return channel; },
    };
    channels.push(channel); return channel;
  },
  removeChannel: (channel: Channel) => { channel.status?.("CLOSED"); return Promise.resolve(); },
  from: (table: string) => {
    const builder: Record<string, any> = {};
    for (const method of ["select", "eq", "ilike", "abortSignal"]) builder[method] = () => builder;
    builder.maybeSingle = () => {
      if (table === "car_washes") return Promise.resolve({ data: null });
      if (loadCount++ === 0) return new Promise((resolve) => { resolveLoad = resolve; });
      return Promise.resolve({ data: null, error: null });
    };
    return builder;
  },
  rpc: async (_name: string, args: Record<string, unknown>) => { writes.push(args); return { data: { status: "saved" }, error: null }; },
} }));
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ ...(options as object), useSearch: () => search }),
  useNavigate: () => () => {}, Link: ({ children }: any) => <div>{children}</div>,
}));
mock.module("@/lib/auth-context", () => ({ useAuth: () => ({ user, profile, loading: false }) }));
mock.module("@/lib/realtime-recovery", () => ({ useRealtimeGeneration: () => generation, handleChannelStatus: (status: string) => statuses.push(status) }));
mock.module("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQueryClient: () => client,
  useQuery: (options: any) => {
    const key = options.queryKey[0];
    const data = key === "pickups" ? requests : key === "parked-cars" ? cached : key === "pickup-taken-cars" ? taken : key === "dealership-settings" ? { company_code: "JCD29854", ro_format: "six_digits" } : key === "directory" || key === "car-photo-index" ? {} : [];
    return { data, isPending: data === undefined, isError: false };
  },
}));
mock.module("@/lib/directory.functions", () => ({ getDirectory: async () => [], searchCars: async () => [] }));
mock.module("@/lib/car-photos", () => ({ carPhotoIndexQuery: () => ({ queryKey: ["car-photo-index"] }), uploadCarPhoto: async () => {} }));
mock.module("@/lib/push", () => ({ notify: () => {} }));
mock.module("sonner", () => ({ toast: { error: () => {}, success: () => {}, message: () => {} } }));
mock.module("@/components/BottomBar", () => ({ BottomBar: () => null, HuriLogo: () => null, TopActions: () => null }));
for (const [path, name] of [["LocationPicker", "LocationPicker"], ["LotMap", "LotMap"], ["CarHistory", "CarHistory"], ["CarPhotos", "CarPhotos"], ["PhotoBadge", "PhotoBadge"], ["CompanyLotGrid", "CompanyLotGrid"]]) {
  mock.module(`@/components/${path}`, () => ({ [name]: () => null }));
}
const { Route: pickupRoute } = await import("../routes/pickup");
const { Route: parkRoute } = await import("../routes/park");
const Pickup = (pickupRoute as any).component;
const Park = (parkRoute as any).component;
async function mount(Component: any): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => { renderer = create(<Component />); });
  if (!renderer) throw new Error("Screen did not mount");
  return renderer;
}

test("pending/results/TAKEN patches keep one queue channel; cleanup is not a failure", async () => {
  Object.assign(globalThis, { window: { Notification: function () {} } });
  const screen = await mount(Pickup);
  const queue = channels.find((c) => c.name.startsWith("pickup-queue"));
  expect(queue).toBeDefined();
  await act(async () => { screen.update(<Pickup />); });
  requests = [{ id: "request", ro_number: "193626", status: "unclaimed", kind: "pickup", created_at: new Date().toISOString() }];
  await act(async () => { screen.update(<Pickup />); });
  taken = [{ ...car, lot_position: "TAKEN" }];
  await act(async () => { screen.update(<Pickup />); });
  await act(async () => { queue?.handlers.parked_cars({ eventType: "UPDATE", old: {}, new: { ...car, dealership_id: "company" } }); });
  expect(invalidations).toContainEqual({ queryKey: ["pickup-taken-cars"] });
  expect(channels.filter((c) => c.name.startsWith("pickup-queue"))).toHaveLength(1);
  queue?.status?.("CHANNEL_ERROR");
  expect(statuses).toEqual(["CHANNEL_ERROR"]);
  generation++;
  profile = { ...profile };
  await act(async () => { screen.update(<Pickup />); });
  expect(channels.filter((c) => c.name.startsWith("pickup-queue"))).toHaveLength(2);
  expect(statuses).toEqual(["CHANNEL_ERROR"]);
  await act(async () => { screen.unmount(); });
  expect(statuses).toEqual(["CHANNEL_ERROR"]);
});

test("Lot/Flagged ID editor keeps typed RO through late lookup and saves same car", async () => {
  loadCount = 0;
  cached = [car];
  const screen = await mount(Park);
  const inputs = () => screen.root.findAllByType("input");
  expect(inputs()[0].props.value).toBe("193626");
  await act(async () => { inputs()[0].props.onChange({ target: { value: "193627" } }); });
  expect(inputs()[0].props.value).toBe("193627");
  expect(inputs()[1].props.value).toBe("Jeep GC");
  await act(async () => { resolveLoad?.({ data: car, error: null }); });
  expect(inputs()[0].props.value).toBe("193627");
  expect(loadCount).toBe(1);
  await act(async () => { await screen.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
  expect(writes[0]).toMatchObject({ _target_id: "car", _ro_number: "193627", _position: "SV 3", _car_model: "Jeep GC", _notes: "Key inside" });
  await act(async () => { screen.unmount(); });
});