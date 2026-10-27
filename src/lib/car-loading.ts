/** Fetch complete pages without publishing a partial result on failure. */
export async function loadAllCarPages<T>(
  fetchPage: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>,
): Promise<T[]> {
  const pageSize = 1000;
  const rows: T[] = [];
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1);
    if (error) throw error;
    const page = data ?? [];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
}

export function isActiveCar(car: { lot_position: string }): boolean {
  return car.lot_position !== "TAKEN";
}

export function mergeLoadedCarDetails(
  current: { model: string; notes: string; pos: string },
  saved: { car_model: string | null; notes: string | null; lot_position: string },
  edited: { model: boolean; notes: boolean; pos: boolean },
) {
  return {
    model: edited.model ? current.model : saved.car_model ?? "",
    notes: edited.notes ? current.notes : saved.notes ?? "",
    pos: edited.pos ? current.pos : ["UNKNOWN", "TAKEN"].includes(saved.lot_position) ? "" : saved.lot_position,
  };
}