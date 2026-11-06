import { expect, mock, test } from "bun:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

// Mount the real screens with controlled query/network boundaries, no live writes.
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
const user: { id: string; email?: string } = { id: "valet" };
let profile = { id: "valet", dealership_id: "company", role_name: "Valet", status: "approved", is_active: true };
let search: { id?: string; ro?: string; from?: string } = { id: "car", from: "flagged" };
let generation = 0;
let taken: unknown[] | undefined;
let requests: unknown[] = [];
const car = { id: "car", ro_number: "193626", car_model: "Jeep GC", notes: "Key inside", lot_position: "SV 3" };
let cached: unknown[] = [car];
const invalidations: unknown[] = [];
const writes: Record<string, unknown>[] = [];
const pinWrites: { table: string; values: Record<string, unknown> }[] = [];
let holdPinWrites = false;
const startedPinWrites: string[] = [];
const releasePinWrites: (() => void)[] = [];
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
function ManualMapStub(_props: any) { return null; }
mock.module("@/components/ManualPinMapModal", () => ({ default: ManualMapStub }));
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
    for (const method of ["select", "eq", "ilike", "abortSignal", "in"]) builder[method] = () => builder;
    builder.update = (values: Record<string, unknown>) => { pinWrites.push({ table, values }); return builder; };
    builder.then = (resolve: (value: unknown) => unknown) => {
      if (!holdPinWrites) return Promise.resolve({ data: [{ id: "car" }], error: null }).then(resolve);
      startedPinWrites.push(table);
      return new Promise((release) => { releasePinWrites.push(() => release({ error: null })); }).then(resolve);
    };
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
    const data = key === "pickups" ? requests : key === "parked-cars" ? cached : key === "pickup-taken-cars" ? taken : key === "dealership-settings" ? { company_code: "JCD29854", ro_format: "digits_6" } : key === "directory" || key === "car-photo-index" ? {} : [];
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
const { GpsPinProvider } = await import("./use-gps-pin");
async function mount(Component: any): Promise<ReactTestRenderer> {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => { renderer = create(<GpsPinProvider><Component /></GpsPinProvider>); });
  if (!renderer) throw new Error("Screen did not mount");
  return renderer;
}

test("pending/results/TAKEN patches keep one queue channel; cleanup is not a failure", async () => {
  Object.assign(globalThis, { window: { Notification: function () {} } });
  const screen = await mount(Pickup);
  const queue = channels.find((c) => c.name.startsWith("pickup-queue"));
  expect(queue).toBeDefined();
  await act(async () => { screen.update(<GpsPinProvider><Pickup /></GpsPinProvider>); });
  requests = [{ id: "request", ro_number: "193626", status: "unclaimed", kind: "pickup", created_at: new Date().toISOString() }];
  await act(async () => { screen.update(<GpsPinProvider><Pickup /></GpsPinProvider>); });
  taken = [{ ...car, lot_position: "TAKEN" }];
  await act(async () => { screen.update(<GpsPinProvider><Pickup /></GpsPinProvider>); });
  await act(async () => { queue?.handlers.parked_cars({ eventType: "UPDATE", old: {}, new: { ...car, dealership_id: "company" } }); });
  expect(invalidations).toContainEqual({ queryKey: ["pickup-taken-cars"] });
  expect(channels.filter((c) => c.name.startsWith("pickup-queue"))).toHaveLength(1);
  queue?.status?.("CHANNEL_ERROR");
  expect(statuses).toEqual(["CHANNEL_ERROR"]);
  generation++;
  profile = { ...profile };
  await act(async () => { screen.update(<GpsPinProvider><Pickup /></GpsPinProvider>); });
  expect(channels.filter((c) => c.name.startsWith("pickup-queue"))).toHaveLength(2);
  expect(statuses).toEqual(["CHANNEL_ERROR"]);
  await act(async () => { screen.unmount(); });
  expect(statuses).toEqual(["CHANNEL_ERROR"]);
});

test("Park applies one stationary precision correction but stops correction when leaving the screen", async () => {
  let ok: PositionCallback = () => {};
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { hidden: false, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { geolocation: {
    watchPosition: (callback: PositionCallback) => { ok = callback; return 1; }, clearWatch() {},
  } } });
  let screen: ReactTestRenderer | undefined;
  try {
    user.email = "aron@huri.team";
    cached = [{ ...car, lot_position: "" }]; loadCount = 0; pinWrites.length = 0;
    screen = await mount(Park);
    const timestamp = Date.now();
    const emit = (feet: number, at: number) => ok({ coords: { latitude: 34.123, longitude: -117.456, accuracy: feet / 3.28084, speed: 0 }, timestamp: at } as GeolocationPosition);
    await act(async () => emit(26, timestamp - 100));
    const drop = screen.root.findAllByType("button").find((button) => button.props.onClick?.name === "dropPin");
    if (!drop) throw new Error("Pin control missing");
    await act(async () => { await drop.props.onClick(); });
    expect(pinWrites).toHaveLength(2);
    await act(async () => emit(7, timestamp));
    expect(pinWrites).toHaveLength(4);
    expect(pinWrites[2]).toEqual({ table: "parked_cars", values: {
      latitude: 34.123, longitude: -117.456, accuracy_ft: 7, pinned_at: new Date(timestamp).toISOString(),
    } });
    expect(pinWrites[3]?.values).toEqual(pinWrites[2]?.values);
    await act(async () => emit(6, timestamp + 1));
    expect(pinWrites).toHaveLength(4);
    await act(async () => screen?.update(<GpsPinProvider><Pickup /></GpsPinProvider>));
    await act(async () => emit(5, timestamp + 2));
    expect(pinWrites).toHaveLength(4);
  } finally {
    await act(async () => screen?.unmount());
    delete user.email;
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
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

test("Tristan's claimed pinned pickup has one active satellite map action, hidden from others", async () => {
  const previousRequests = requests;
  requests = [{ id: "pinned-request", ro_number: "000006", status: "claimed", claimed_at: new Date().toISOString(), claimed_by: "valet", kind: "pickup", created_at: new Date().toISOString(), latitude: 34.123, longitude: -117.456 }];
  user.email = "tristan4par@yahoo.com";
  try {
    const screen = await mount(Pickup);
    const satellite = screen.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Show on satellite map");
    expect(satellite).toHaveLength(1);
    expect(satellite[0].props.disabled).not.toBe(true);
    expect(screen.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Show on lot map")).toHaveLength(0);
    delete user.email;
    await act(async () => screen.update(<GpsPinProvider><Pickup /></GpsPinProvider>));
    expect(screen.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Show on satellite map")).toHaveLength(0);
    expect(screen.root.findAllByType("button").filter((button) => button.props["aria-label"] === "Show on lot map")).toHaveLength(1);
    await act(async () => screen.unmount());
  } finally { requests = previousRequests; delete user.email; }
});

test("Tristan pin drop saves concurrently and keeps foreground GPS until authorization loss", async () => {
  let ok: PositionCallback = () => {};
  let watches = 0;
  const cleared: number[] = [];
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, "navigator");
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  Object.defineProperty(globalThis, "document", { configurable: true, value: { hidden: false, addEventListener() {}, removeEventListener() {} } });
  Object.defineProperty(globalThis, "navigator", { configurable: true, value: { geolocation: {
    watchPosition: (callback: PositionCallback) => { ok = callback; return ++watches; },
    clearWatch: (id: number) => { cleared.push(id); },
  } } });
  try {
    const regular = await mount(Park);
    expect(watches).toBe(0);
    await act(async () => regular.unmount());
    user.email = "tristan4par@yahoo.com";
    cached = [{ ...car, lot_position: "" }];
    loadCount = 0;
    pinWrites.length = 0;
    startedPinWrites.length = 0;
    releasePinWrites.length = 0;
    const screen = await mount(Park);
    expect(watches).toBe(1);
    const timestamp = Date.now();
    await act(async () => ok({ coords: { latitude: 34.123, longitude: -117.456, accuracy: 4 }, timestamp } as GeolocationPosition));
    const button = screen.root.findAllByType("button").find((item) => item.props.onClick?.name === "dropPin");
    if (!button) throw new Error("Pin drop control missing");
    holdPinWrites = true;
    let dropping: Promise<void> | undefined;
    await act(async () => { dropping = button.props.onClick(); await Promise.resolve(); });
    expect(startedPinWrites).toEqual(["parked_cars", "pickup_requests"]);
    await act(async () => { releasePinWrites.forEach((release) => release()); await dropping; });
    holdPinWrites = false;
    expect(pinWrites).toEqual([
      { table: "parked_cars", values: { latitude: 34.123, longitude: -117.456, accuracy_ft: 13, pinned_at: new Date(timestamp).toISOString(), lot_position: "GPS", parked_by: "valet" } },
      { table: "pickup_requests", values: { latitude: 34.123, longitude: -117.456, accuracy_ft: 13, pinned_at: new Date(timestamp).toISOString() } },
    ]);
    await act(async () => { resolveLoad?.({ data: car, error: null }); });
    await act(async () => { await screen.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(writes.at(-1)).toMatchObject({ _ro_number: "193626", _position: "GPS" });
    expect(cleared).toEqual([]);
    await act(async () => screen.update(<GpsPinProvider><Pickup /></GpsPinProvider>));
    expect(watches).toBe(1);
    expect(cleared).toEqual([]);
    delete user.email;
    await act(async () => screen.update(<GpsPinProvider><Pickup /></GpsPinProvider>));
    expect(cleared).toEqual([1]);
    await act(async () => screen.unmount());
    expect(cleared).toEqual([1]);
    user.email = "aron@huri.team";
    const blocked = await mount(Park);
    await act(async () => blocked.unmount());
    expect(watches).toBe(2);
    profile = { ...profile, role_name: "Spectator" };
    const spectator = await mount(Park);
    expect(watches).toBe(2);
    await act(async () => spectator.unmount());
    profile = { ...profile, role_name: "Valet", status: "pending" };
    const pending = await mount(Park);
    expect(watches).toBe(2);
    await act(async () => pending.unmount());
  } finally {
    holdPinWrites = false;
    delete user.email;
    profile = { ...profile, role_name: "Valet", status: "approved" };
    if (originalNavigator) Object.defineProperty(globalThis, "navigator", originalNavigator);
    else Reflect.deleteProperty(globalThis, "navigator");
    if (originalDocument) Object.defineProperty(globalThis, "document", originalDocument);
    else Reflect.deleteProperty(globalThis, "document");
  }
});

test("manual pin stages without writes and saves coordinates after normal spot assignment", async () => {
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: { getItem: () => "manual" } });
  user.email = "tristan4par@yahoo.com";
  cached = [car]; loadCount = 0; pinWrites.length = 0;
  let screen: ReactTestRenderer | undefined;
  try {
    screen = await mount(Park);
    const drop = screen.root.findAllByType("button").find((b) => b.props.onClick?.name === "dropPin");
    if (!drop) throw new Error("No manual control");
    await act(async () => { await drop.props.onClick(); });
    const selected = { latitude: 34.0506, longitude: -117.54225, location: "SV 120", pinned_at: "2026-11-06T01:00:00.000Z" };
    await act(async () => { screen?.root.findByType(ManualMapStub).props.onSave(selected); });
    expect(pinWrites).toHaveLength(0);
    await act(async () => { await screen?.root.findByType("form").props.onSubmit({ preventDefault() {} }); });
    expect(writes.at(-1)).toMatchObject({ _target_id: "car", _position: "SV 120", _car_model: "Jeep GC", _notes: "Key inside" });
    expect(pinWrites).toEqual([
      { table: "parked_cars", values: { latitude: selected.latitude, longitude: selected.longitude, accuracy_ft: null, pinned_at: selected.pinned_at } },
      { table: "pickup_requests", values: { latitude: selected.latitude, longitude: selected.longitude, accuracy_ft: null, pinned_at: selected.pinned_at } },
    ]);
  } finally {
    await act(async () => screen?.unmount()); delete user.email;
    if (originalStorage) Object.defineProperty(globalThis, "localStorage", originalStorage);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});