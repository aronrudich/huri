import { useEffect, useState } from "react";

export type GpsPinMode = "auto" | "manual";
export function useGpsPinMode(userId?: string) {
  const [mode, setMode] = useState<GpsPinMode>("auto");
  useEffect(() => {
    setMode("auto");
    if (!userId) return;
    try { setMode(localStorage.getItem(`huri_gps_pin_mode:${userId}`) === "manual" ? "manual" : "auto"); } catch { /* Storage is optional. */ }
  }, [userId]);
  const changeMode = (next: GpsPinMode) => {
    setMode(next);
    if (userId) try { localStorage.setItem(`huri_gps_pin_mode:${userId}`, next); } catch { /* Keep this session's preference. */ }
  };
  return { mode, changeMode };
}