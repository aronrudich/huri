type FullscreenVideo = {
  play: () => Promise<void>;
  requestFullscreen?: () => Promise<void>;
  webkitEnterFullscreen?: () => void;
};
/** Called directly from a user gesture; playback remains available if fullscreen is denied. */
export function playVideoFullscreen(video: FullscreenVideo, fallback?: () => void) {
  const playing = video.play().catch(() => undefined);
  try {
    if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else if (video.requestFullscreen) void video.requestFullscreen().catch(() => fallback?.());
    else fallback?.();
  } catch { fallback?.(); }
  return playing;
}