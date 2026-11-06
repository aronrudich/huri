export type MapPoint = { latitude: number; longitude: number };
export type ManualPin = MapPoint & { location: string; pinned_at: string };
export type PinZone = { companyCode: string; location: string; maxSpot: number; corners: MapPoint[] };

export const PIN_ZONES: PinZone[] = [
  { companyCode: "BMWR2985", location: "Service Lot", maxSpot: 128, corners: [
    { latitude: 33.922731, longitude: -117.418040 },
    { latitude: 33.922518, longitude: -117.418378 },
    { latitude: 33.921832, longitude: -117.417873 },
    { latitude: 33.922060, longitude: -117.417535 },
  ] },
  { companyCode: "JCD29854", location: "SV", maxSpot: 120, corners: [
    { latitude: 34.051268, longitude: -117.542451 },
    { latitude: 34.051272, longitude: -117.542064 },
    { latitude: 34.049996, longitude: -117.542048 },
    { latitude: 34.049994, longitude: -117.542440 },
  ] },
];

export function pointInPolygon(point: MapPoint, corners: MapPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = corners.length - 1; i < corners.length; j = i++) {
    const a = corners[i], b = corners[j];
    const cross = (point.longitude - a.longitude) * (b.latitude - a.latitude) - (point.latitude - a.latitude) * (b.longitude - a.longitude);
    if (Math.abs(cross) < 1e-12 && point.longitude >= Math.min(a.longitude, b.longitude) && point.longitude <= Math.max(a.longitude, b.longitude)
      && point.latitude >= Math.min(a.latitude, b.latitude) && point.latitude <= Math.max(a.latitude, b.latitude)) return true;
    if ((a.latitude > point.latitude) !== (b.latitude > point.latitude)
      && point.longitude < (b.longitude - a.longitude) * (point.latitude - a.latitude) / (b.latitude - a.latitude) + a.longitude) inside = !inside;
  }
  return inside;
}

export function pinZoneAt(companyCode: string | undefined, point: MapPoint): PinZone | null {
  return PIN_ZONES.find((zone) => zone.companyCode === companyCode && pointInPolygon(point, zone.corners)) ?? null;
}

export function lotCenter(companyCode?: string): MapPoint | null {
  const zone = PIN_ZONES.find((item) => item.companyCode === companyCode);
  if (!zone) return null;
  return { latitude: zone.corners.reduce((sum, p) => sum + p.latitude, 0) / zone.corners.length,
    longitude: zone.corners.reduce((sum, p) => sum + p.longitude, 0) / zone.corners.length };
}

export function manualPinLocation(companyCode: string | undefined, point: MapPoint, spot: string): string | null {
  const zone = pinZoneAt(companyCode, point);
  if (!zone) return "GPS";
  if (!/^\d+$/.test(spot) || Number(spot) < 1 || Number(spot) > zone.maxSpot) return null;
  return `${zone.location} ${Number(spot)}`;
}