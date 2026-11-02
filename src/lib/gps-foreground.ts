import type { GpsPinTracker } from "./gps-pin";

/** Visibility owns the watch, not individual pages. All work stays device-local. */
export function watchForegroundGps(
  tracker: Pick<GpsPinTracker, "start" | "stop">,
  visibility: Pick<Document, "hidden" | "addEventListener" | "removeEventListener">,
  changed: (active: boolean) => void,
) {
  const sync = () => {
    if (visibility.hidden) tracker.stop();
    else tracker.start();
    changed(!visibility.hidden);
  };
  visibility.addEventListener("visibilitychange", sync);
  sync();
  return () => {
    visibility.removeEventListener("visibilitychange", sync);
    tracker.stop();
    changed(false);
  };
}