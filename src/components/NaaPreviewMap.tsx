import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { TransformComponent, TransformWrapper, type ReactZoomPanPinchRef } from "react-zoom-pan-pinch";
import { ArrowLeft, CarFront, LocateFixed, Minus, Plus, Search, X } from "lucide-react";
import { Switch } from "@/components/ui/switch";

type ZoneId = "front" | "lanes" | "yard" | "recon" | "transport";
type ViewId = "all" | ZoneId;
type StallStatus = "open" | "occupied" | "pull" | "staged";

type Stall = {
  id: string;
  zone: ZoneId;
  status: StallStatus;
  x: number;
  y: number;
  width: number;
  height: number;
  stock?: string;
  vin?: string;
  vehicle?: string;
  notes?: string;
  blockerId?: string;
};

const VIEW_OPTIONS: Array<{ id: ViewId; label: string }> = [
  { id: "all", label: "All" },
  { id: "front", label: "Front Lot" },
  { id: "lanes", label: "Run Lanes" },
  { id: "yard", label: "Main Yard" },
  { id: "recon", label: "North Recon" },
  { id: "transport", label: "Transporters" },
];

const ZONE_META: Record<ZoneId, { label: string; count: number }> = {
  front: { label: "A · Front Lot", count: 45 },
  lanes: { label: "B · Run Lanes", count: 48 },
  yard: { label: "C · Main Inventory Yard", count: 420 },
  recon: { label: "D · North Recon / Detail", count: 40 },
  transport: { label: "W · Transporter Intake & Overflow", count: 35 },
};

const VEHICLES = [
  "2024 Toyota Camry",
  "2023 Honda CR-V",
  "2022 Ford F-150",
  "2024 Hyundai Tucson",
  "2021 Chevrolet Tahoe",
  "2023 Nissan Rogue",
];

function mockState(index: number, zone: ZoneId): StallStatus {
  if (zone === "lanes" && index % 4 === 0) return "staged";
  if (index % 17 === 0) return "pull";
  if (index % 3 === 0 || index % 7 === 0) return "occupied";
  return "open";
}

function withVehicle(stall: Omit<Stall, "status">, index: number, zone: ZoneId): Stall {
  const status = mockState(index, zone);
  if (status === "open") return { ...stall, status };
  const serial = String(51000 + index).padStart(6, "0");
  return {
    ...stall,
    status,
    stock: `N${serial}`,
    vin: `1NAA${String(900000000000 + index).slice(-12)}`,
    vehicle: VEHICLES[index % VEHICLES.length],
    notes: status === "pull" ? "Transport team requested this vehicle." : status === "staged" ? "Ready for the auction block." : "Mock vehicle for layout testing.",
  };
}

function buildStalls(): Stall[] {
  const stalls: Stall[] = [];

  for (let i = 0; i < 45; i += 1) {
    stalls.push(withVehicle({ id: `F${String(i + 1).padStart(2, "0")}`, zone: "front", x: 360 + (i % 15) * 58, y: 910 + Math.floor(i / 15) * 42, width: 52, height: 34 }, i + 1, "front"));
  }
  for (let lane = 1; lane <= 6; lane += 1) {
    for (let slot = 1; slot <= 8; slot += 1) {
      const index = (lane - 1) * 8 + slot;
      stalls.push(withVehicle({ id: `L${lane}-${slot}`, zone: "lanes", x: 470 + (lane - 1) * 115, y: 84 + (slot - 1) * 24, width: 104, height: 20 }, index, "lanes"));
    }
  }
  let pairIndex = 0;
  for (let rowNumber = 1; rowNumber <= 22; rowNumber += 1) {
    const baysInRow = rowNumber <= 12 ? 10 : 9;
    for (let bay = 1; bay <= baysInRow; bay += 1) {
      pairIndex += 1;
      const rowLabel = `R${String(rowNumber).padStart(2, "0")}`;
      const baseId = bay === 1 ? rowLabel : `${rowLabel}-${String(bay).padStart(2, "0")}`;
      const x = 250 + (bay - 1) * 105;
      const y = 315 + (rowNumber - 1) * 25;
      const frontId = `${baseId}-F`;
      stalls.push(withVehicle({ id: frontId, zone: "yard", x: x + 48, y, width: 44, height: 20 }, pairIndex * 2, "yard"));
      stalls.push(withVehicle({ id: `${baseId}-B`, zone: "yard", x, y, width: 44, height: 20, blockerId: frontId }, pairIndex * 2 + 1, "yard"));
    }
  }
  for (let i = 0; i < 40; i += 1) {
    stalls.push(withVehicle({ id: `D${String(i + 1).padStart(2, "0")}`, zone: "recon", x: 46 + (i % 5) * 62, y: 80 + Math.floor(i / 5) * 31, width: 56, height: 26 }, i + 1, "recon"));
  }
  for (let i = 0; i < 35; i += 1) {
    stalls.push(withVehicle({ id: `W${String(i + 1).padStart(2, "0")}`, zone: "transport", x: 1350 + (i % 5) * 48, y: 185 + Math.floor(i / 5) * 48, width: 42, height: 40 }, i + 1, "transport"));
  }
  return stalls;
}

const INITIAL_STALLS = buildStalls();

const STATUS_LABEL: Record<StallStatus, string> = {
  open: "Open",
  occupied: "Occupied",
  pull: "Active pull",
  staged: "Staged",
};

function stallClass(status: StallStatus, selected: boolean) {
  const tone = status === "pull"
    ? "bg-primary text-primary-foreground border-primary"
    : status === "occupied"
      ? "bg-destructive text-destructive-foreground border-destructive"
      : status === "staged"
        ? "naa-checkered text-foreground border-foreground"
        : "bg-background/80 text-foreground border-foreground/60";
  return `${tone} ${selected ? "ring-2 ring-warning ring-offset-1 ring-offset-surface" : ""}`;
}

function MapControls({ api }: { api: ReactZoomPanPinchRef | null }) {
  return (
    <div className="absolute bottom-3 right-3 z-20 flex flex-col overflow-hidden rounded-lg border bg-background shadow-lg">
      <button type="button" className="grid size-10 place-items-center border-b active:bg-accent" onClick={() => api?.zoomIn(0.35)} aria-label="Zoom in" title="Zoom in"><Plus className="size-4" /></button>
      <button type="button" className="grid size-10 place-items-center border-b active:bg-accent" onClick={() => api?.zoomOut(0.35)} aria-label="Zoom out" title="Zoom out"><Minus className="size-4" /></button>
      <button type="button" className="grid size-10 place-items-center active:bg-accent" onClick={() => api?.resetTransform(300)} aria-label="Reset map view" title="Reset map view"><LocateFixed className="size-4" /></button>
    </div>
  );
}

export function NaaPreviewMap() {
  const [view, setView] = useState<ViewId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [api, setApi] = useState<ReactZoomPanPinchRef | null>(null);
  const [overrides, setOverrides] = useState<Record<string, StallStatus>>({});

  const stalls = useMemo(() => INITIAL_STALLS.map((stall) => ({ ...stall, status: overrides[stall.id] ?? stall.status })), [overrides]);
  const selected = stalls.find((stall) => stall.id === selectedId) ?? null;
  const blocker = selected?.blockerId ? stalls.find((stall) => stall.id === selected.blockerId) ?? null : null;
  const visibleStalls = view === "all" ? stalls : stalls.filter((stall) => stall.zone === view);
  const normalizedQuery = query.trim().toUpperCase();
  const matches = normalizedQuery.length < 2
    ? []
    : stalls.filter((stall) => stall.id.includes(normalizedQuery) || stall.stock?.includes(normalizedQuery) || stall.vin?.includes(normalizedQuery)).slice(0, 8);

  const focusElement = (elementId: string) => {
    window.setTimeout(() => api?.zoomToElement(elementId, 1.65, 350, "easeOut"), 40);
  };

  const selectView = (next: ViewId) => {
    setView(next);
    setSelectedId(null);
    window.setTimeout(() => {
      if (next === "all") api?.resetTransform(350);
      else api?.zoomToElement(`naa-zone-${next}`, 0.92, 350, "easeOut");
    }, 40);
  };

  const chooseMatch = (stall: Stall) => {
    setView("all");
    setSelectedId(stall.id);
    setQuery(stall.id);
    focusElement(`naa-stall-${stall.id}`);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-surface">
      <div className="border-b bg-background px-4 py-3">
        <div className="mx-auto flex max-w-7xl flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Link to="/pickup" className="grid size-8 shrink-0 place-items-center rounded-full border bg-background active:bg-accent" aria-label="Exit sandbox" title="Exit sandbox">
                  <ArrowLeft className="size-4" />
                </Link>
                <span className="rounded bg-warning px-2 py-1 text-[10px] font-bold uppercase text-warning-foreground">Sandbox</span>
                <h1 className="text-lg font-bold">NAA Test Map</h1>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">Norwalk Auto Auction · 588 mock stalls</p>
            </div>
            <label className="ml-auto flex shrink-0 items-center gap-2 rounded-lg border bg-muted px-3 py-2 text-xs font-semibold">
              <Switch checked={view === "all"} onCheckedChange={(checked) => selectView(checked ? "all" : "front")} aria-label="View entire property" />
              Entire property
            </label>
            <div className="hidden items-center gap-3 text-xs lg:flex">
              <span className="flex items-center gap-1.5"><span className="size-3 border border-foreground/60 bg-background" /> Open</span>
              <span className="flex items-center gap-1.5"><span className="size-3 bg-destructive" /> Occupied</span>
              <span className="flex items-center gap-1.5"><span className="size-3 bg-primary" /> Active pull</span>
              <span className="flex items-center gap-1.5"><span className="naa-checkered size-3 border" /> Staged</span>
            </div>
          </div>

          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Enter" && matches[0]) chooseMatch(matches[0]); }}
              placeholder="Search stock #, VIN, or spot"
              aria-label="Search the NAA test map"
              className="h-11 w-full rounded-lg border bg-background pl-10 pr-10 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
            {query && <button type="button" aria-label="Clear search" title="Clear search" onClick={() => setQuery("")} className="absolute right-2 top-1/2 grid size-8 -translate-y-1/2 place-items-center rounded active:bg-accent"><X className="size-4" /></button>}
            {matches.length > 0 && query !== selectedId && (
              <div className="absolute left-0 right-0 top-12 z-40 max-h-64 overflow-y-auto rounded-lg border bg-popover shadow-xl">
                {matches.map((stall) => (
                  <button key={stall.id} type="button" onClick={() => chooseMatch(stall)} className="flex w-full items-center justify-between border-b px-3 py-2.5 text-left last:border-b-0 active:bg-accent">
                    <span><strong className="text-sm">{stall.id}</strong><span className="ml-2 text-xs text-muted-foreground">{ZONE_META[stall.zone].label}</span></span>
                    <span className="text-xs font-medium">{stall.stock ?? "Open"}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex gap-2 overflow-x-auto pb-1">
            {VIEW_OPTIONS.map((option) => (
              <button key={option.id} type="button" onClick={() => selectView(option.id)} className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-semibold ${view === option.id ? "border-primary bg-primary text-primary-foreground" : "bg-background text-foreground active:bg-accent"}`}>
                {option.label}{option.id !== "all" ? ` (${ZONE_META[option.id].count})` : " (588)"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative min-h-[520px] flex-1 overflow-hidden bg-muted">
        <TransformWrapper
          ref={(ref) => setApi(ref)}
          initialScale={0.72}
          minScale={0.5}
          maxScale={4}
          centerOnInit
          limitToBounds={false}
          wheel={{ step: 0.08 }}
          pinch={{ step: 4 }}
          doubleClick={{ mode: "zoomIn", step: 0.5 }}
        >
          <TransformComponent wrapperClass="!h-full !w-full" contentClass="!h-full !w-full">
            <div className="relative h-[1120px] w-[1640px] overflow-hidden bg-surface naa-property-grid" aria-label="Complete NAA property map with 588 stalls">
              <div className="absolute left-[450px] top-[22px] text-center">
                <p className="text-xl font-black">NORWALK AUTO AUCTION</p>
                <p className="text-xs font-semibold text-muted-foreground">Complete property concept · not live</p>
              </div>
              {(Object.keys(ZONE_META) as ZoneId[]).map((zone) => {
                const positions: Record<ZoneId, string> = {
                  recon: "left-[24px] top-[52px] h-[290px] w-[330px]",
                  lanes: "left-[440px] top-[52px] h-[225px] w-[720px]",
                  yard: "left-[220px] top-[292px] h-[590px] w-[1135px]",
                  transport: "left-[1325px] top-[154px] h-[395px] w-[285px]",
                  front: "left-[330px] top-[880px] h-[180px] w-[930px]",
                };
                return (
                  <div key={zone} id={`naa-zone-${zone}`} className={`absolute rounded-lg border-2 border-dashed border-muted-foreground/50 bg-background/40 ${positions[zone]} ${view !== "all" && view !== zone ? "opacity-15" : ""}`}>
                    <div className="absolute -top-7 left-0 rounded-t bg-foreground px-2 py-1 text-[10px] font-bold uppercase text-background">{ZONE_META[zone].label} · {ZONE_META[zone].count}</div>
                  </div>
                );
              })}
              <div className="absolute left-[20px] top-[420px] w-[170px] rounded border bg-background/90 p-3 shadow-sm">
                <p className="text-xs font-bold">Office & check-in</p>
                <p className="mt-1 text-[10px] text-muted-foreground">Auction operations</p>
              </div>
              <div className="absolute left-[20px] top-[600px] h-[250px] w-[170px] rounded border bg-secondary/80 p-3">
                <p className="text-xs font-bold">Auction block</p>
                <div className="mt-8 border-y-4 border-foreground/20 py-8 text-center text-[10px] font-semibold">Vehicle run path</div>
              </div>
              {visibleStalls.map((stall) => (
                <button
                  key={stall.id}
                  id={`naa-stall-${stall.id}`}
                  type="button"
                  title={`${stall.id} · ${STATUS_LABEL[stall.status]}${stall.stock ? ` · ${stall.stock}` : ""}`}
                  aria-label={`${stall.id}, ${STATUS_LABEL[stall.status]}${stall.stock ? `, stock ${stall.stock}` : ""}`}
                  onClick={() => setSelectedId(stall.id)}
                  className={`absolute flex items-center justify-center overflow-hidden border text-[7px] font-extrabold leading-none shadow-sm active:brightness-90 ${stallClass(stall.status, selectedId === stall.id)}`}
                  style={{ left: stall.x, top: stall.y, width: stall.width, height: stall.height }}
                >
                  {stall.id}
                </button>
              ))}
              <div className="absolute bottom-[28px] left-[32px] text-xs font-semibold text-muted-foreground">ROSECRANS AVENUE</div>
              <div className="absolute right-[24px] top-[40px] text-[10px] font-semibold text-muted-foreground">N ↑</div>
            </div>
          </TransformComponent>
        </TransformWrapper>
        <MapControls api={api} />
        <div className="absolute bottom-3 left-3 rounded bg-background/90 px-2 py-1 text-[10px] font-medium shadow">Pinch or scroll to zoom · drag to pan</div>
      </div>

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35" onClick={() => setSelectedId(null)}>
          <section className="safe-bottom max-h-[82dvh] w-full max-w-xl overflow-y-auto rounded-t-2xl bg-background p-5 shadow-2xl" onClick={(event) => event.stopPropagation()} aria-label={`${selected.id} details`}>
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-muted-foreground/30" />
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase text-muted-foreground">{ZONE_META[selected.zone].label}</p>
                <h2 className="mt-1 text-2xl font-bold">{selected.id}</h2>
              </div>
              <button type="button" className="grid size-10 place-items-center rounded-full bg-muted active:bg-accent" onClick={() => setSelectedId(null)} aria-label="Close details" title="Close"><X className="size-5" /></button>
            </div>

            {blocker && (
              <div className="mt-4 rounded-lg border border-warning bg-warning/15 p-3">
                <p className="text-sm font-bold">Blocked by Front Stall ({blocker.id})</p>
                <p className="mt-1 text-xs text-muted-foreground">{blocker.vehicle ? `${blocker.vehicle} · ${blocker.stock}` : "Front stall is currently open."}</p>
              </div>
            )}

            {selected.status === "open" ? (
              <div className="mt-5">
                <div className="flex items-center gap-3 rounded-lg bg-muted p-4"><CarFront className="size-6 text-muted-foreground" /><div><p className="font-semibold">Open stall</p><p className="text-sm text-muted-foreground">No vehicle is assigned in this sandbox.</p></div></div>
                <button type="button" className="mt-4 w-full rounded-lg bg-primary px-4 py-3 font-semibold text-primary-foreground active:brightness-90" onClick={() => setOverrides((current) => ({ ...current, [selected.id]: "occupied" }))}>Park Mock Vehicle</button>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                <div className="flex items-center justify-between rounded-lg bg-muted p-3"><span className="text-sm font-medium">Status</span><span className="text-sm font-bold">{STATUS_LABEL[selected.status]}</span></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><p className="text-xs text-muted-foreground">Vehicle</p><p className="mt-1 text-sm font-semibold">{selected.vehicle ?? "2024 Toyota Camry"}</p></div>
                  <div><p className="text-xs text-muted-foreground">Stock #</p><p className="mt-1 text-sm font-semibold tabular-nums">{selected.stock ?? "N051999"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">VIN</p><p className="mt-1 break-all text-sm font-semibold tabular-nums">{selected.vin ?? "1NAA000000000999"}</p></div>
                  <div className="col-span-2"><p className="text-xs text-muted-foreground">Notes</p><p className="mt-1 text-sm">{selected.notes ?? "Mock vehicle parked during this test session."}</p></div>
                </div>
              </div>
            )}
            <p className="mt-5 text-center text-xs text-muted-foreground">Sandbox only · changes are not saved</p>
          </section>
        </div>
      )}
    </div>
  );
}