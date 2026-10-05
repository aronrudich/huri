import type { Addr } from "./BusinessAddress.types";

export type { Addr } from "./BusinessAddress.types";

export const emptyAddr: Addr = { street: "", city: "", state: "", zip: "", formatted: "", lat: null, lng: null, confirmed: false };
export const addrComplete = (a: Addr) => !!(a.street.trim() && a.city.trim() && a.state.trim() && a.zip.trim());

const inputCls = "w-full rounded-xl border border-input bg-background px-3 py-3 text-base outline-none focus:border-primary";

/** Manual address entry only. */
export function BusinessAddress({ value, onChange }: { value: Addr; onChange: (a: Addr) => void }) {
  const setF = (k: "street" | "city" | "state" | "zip") => (v: string) =>
    onChange({ ...value, [k]: v, formatted: "", lat: null, lng: null, confirmed: false });

  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">Address</label>
      <div className="space-y-2">
        <input value={value.street} onChange={(e) => setF("street")(e.target.value.slice(0, 200))} placeholder="Street address" autoComplete="street-address" className={inputCls} />
        <div className="grid grid-cols-2 gap-2">
          <input value={value.city} onChange={(e) => setF("city")(e.target.value.slice(0, 100))} placeholder="City" autoComplete="address-level2" className={inputCls} />
          <input value={value.state} onChange={(e) => setF("state")(e.target.value.slice(0, 100))} placeholder="State" autoComplete="address-level1" className={inputCls} />
        </div>
        <input value={value.zip} onChange={(e) => setF("zip")(e.target.value.slice(0, 20))} placeholder="ZIP code" autoComplete="postal-code" inputMode="numeric" className={inputCls} />
      </div>
    </div>
  );
}
