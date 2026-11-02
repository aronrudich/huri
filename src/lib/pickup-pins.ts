import type { PinnedCarRow } from "./queries";

type PinRequest = {
  id: string; ro_number: string | null; status: string;
  car_model?: string | null; lot_position?: string | null;
  latitude?: number | null; longitude?: number | null;
  accuracy_ft?: number | null; pinned_at?: string | null;
};

/** Input is the visible queue, before text search; completed/unrelated cars cannot enter. */
export function activePickupPins(requests: PinRequest[], cars: PinnedCarRow[]): PinnedCarRow[] {
  const byRo = new Map(cars.map((car) => [car.ro_number?.trim(), car]));
  const pins = new Map<string, PinnedCarRow>();
  for (const request of requests) {
    const ro = request.ro_number?.trim();
    if (!ro || !["unclaimed", "claimed"].includes(request.status) || pins.has(ro)) continue;
    const car = byRo.get(ro);
    // Claimed cars can be TAKEN (absent from active car reads); retain their request pin.
    const pin = car ?? (typeof request.latitude === "number" && typeof request.longitude === "number" ? {
      id: `request:${request.id}`, ro_number: ro, car_model: request.car_model ?? null,
      lot_position: request.lot_position ?? null, latitude: request.latitude, longitude: request.longitude,
      accuracy_ft: request.accuracy_ft ?? null, pinned_at: request.pinned_at ?? null,
    } : null);
    if (pin && Number.isFinite(pin.latitude) && Number.isFinite(pin.longitude)) pins.set(ro, pin);
  }
  return [...pins.values()];
}