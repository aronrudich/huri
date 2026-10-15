declare const __BUILD_ID__: string;

/** Timestamp of the build this code came from; identical in the app and server bundles. */
export const BUILD_ID: string = typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

export function formatBuildId(id: string = BUILD_ID) {
  const d = new Date(id);
  if (Number.isNaN(d.getTime())) return id;
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
    timeZone: "America/Los_Angeles",
  });
}
