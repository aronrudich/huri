export const carTipKey = (userId: string) => `huri_car_button_tip_dismissed:${userId}`;
export function shouldShowCarTip(role: string, userId?: string, dismissed = false) {
  return !!userId && !!role && role.toLowerCase() !== "advisor" && role !== "Spectator" && !dismissed;
}