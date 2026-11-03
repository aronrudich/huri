import { expect, mock, test } from "bun:test";
import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });
let companyCode = "BMWR2985";
const rules = [
  { label: "SERVICE LOT 2", lot_name: "Service Lot", capacity: 1, blockers: [] },
  { label: "SERVICE LOT 10", lot_name: "Service Lot", capacity: 1, blockers: [] },
  ...["Service Done", "Used Car Service", "W1", "W2", "Charging"].map((name) => ({ label: name.toUpperCase(), lot_name: name, capacity: 0, blockers: [] })),
];
const cars = [
  { id: "ten", ro_number: "000010", car_model: "BMW X5", lot_position: "SERVICE LOT 10", notes: "Keys inside" },
  { id: "two", ro_number: "000002", car_model: "BMW X3", lot_position: "SERVICE LOT 2" },
  { id: "wash1", ro_number: "000003", lot_position: "W1" },
  { id: "wash2", ro_number: "000004", lot_position: "W2" },
];
mock.module("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => options,
  useNavigate: () => () => {},
  Link: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));
mock.module("@/lib/auth-context", () => ({ useAuth: () => ({ user: { id: "valet" }, profile: { dealership_id: "bmw" }, loading: false }) }));
mock.module("@/lib/realtime-recovery", () => ({ useRealtimeGeneration: () => 0, handleChannelStatus: () => {} }));
mock.module("@/integrations/supabase/client", () => ({ supabase: {
  channel: () => { const channel = { on: () => channel, subscribe: () => channel }; return channel; }, removeChannel: () => {},
} }));
mock.module("@tanstack/react-query", () => ({
  queryOptions: (options: unknown) => options,
  useQueryClient: () => ({}),
  useQuery: ({ queryKey }: any) => ({ data: queryKey[0] === "dealership-settings" ? { company_code: companyCode } : queryKey[0] === "company-locations" ? rules : queryKey[0] === "parked-cars" ? cars : queryKey[0] === "car-photo-index" ? {} : [], isError: false }),
}));
mock.module("@/lib/car-photos", () => ({ carPhotoIndexQuery: () => ({ queryKey: ["car-photo-index"] }) }));
mock.module("@/lib/queries", () => ({ parkedCarsQuery: () => ({ queryKey: ["parked-cars"] }), lotActivePickupsQuery: () => ({ queryKey: ["lot-active-pickups"] }) }));
mock.module("@/lib/settings", () => ({ dealershipSettingsQuery: () => ({ queryKey: ["dealership-settings"] }) }));
mock.module("@/components/BottomBar", () => ({ BottomBar: () => null, HuriLogo: () => null, TopActions: () => null }));
mock.module("@/components/LotMap", () => ({ LotMap: () => <div data-lot-map /> }));
mock.module("@/components/PhotoBadge", () => ({ PhotoBadge: () => null }));
const { Route } = await import("../routes/lot");
const LotPage = (Route as any).component;

test("BMW live list filters W1/W2, sorts Service Lot numbers and limits search to its selection", async () => {
  let renderer: ReactTestRenderer | undefined;
  await act(async () => { renderer = create(<LotPage />); });
  if (!renderer) throw new Error("Lot did not mount");
  const screen = renderer;
  const ids = () => screen.root.findAllByType("a").map((row) => row.props.search.id);
  const select = async (value: string) => act(async () => screen.root.findByProps({ "aria-label": "Lot location" }).props.onChange({ target: { value } }));
  expect(ids().sort()).toEqual(["ten", "two", "wash1", "wash2"]);
  await select("Service Lot");
  expect(ids()).toEqual(["two", "ten"]);
  await select("W1 & W2");
  expect(ids()).toEqual(["wash1", "wash2"]);
  await act(async () => screen.root.findByType("input").props.onChange({ target: { value: "BMW" } }));
  expect(ids()).toEqual([]);
  await act(async () => screen.unmount());
});

test("JCD retains its existing SV map and three tab choices without a lot dropdown", async () => {
  companyCode = "JCD29854";
  let renderer: ReactTestRenderer | undefined;
  await act(async () => { renderer = create(<LotPage />); });
  if (!renderer) throw new Error("Lot did not mount");
  expect(renderer.root.findAllByType("select")).toHaveLength(0);
  expect(renderer.root.findAllByProps({ "data-lot-map": true })).toHaveLength(1);
  const tabButtons = renderer.root.findAllByType("button").filter((button) => ["SV", "CP", "BL"].includes(button.props.children));
  expect(tabButtons.map((button) => button.props.children)).toEqual(["SV", "CP", "BL"]);
  await act(async () => renderer?.unmount());
});