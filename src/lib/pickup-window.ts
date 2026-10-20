/** Display-only timing. Completion belongs exclusively to the server archive. */
export function claimHideMilliseconds(minutes = 60): number {
  return minutes * 60_000;
}

export function isClaimWithinWindow(claimedAt: string, now: number, duration: number): boolean {
  return now - new Date(claimedAt).getTime() < duration;
}