type FullscreenVideo = {
  play: () => Promise<void>;
  requestFullscreen?: () => Promise<void>;
  webkitEnterFullscreen?: () => void;
};
/** Called directly from a user gesture; playback remains available if fullscreen is denied. */
export function playVideoFullscreen(video: FullscreenVideo) {
  const playing = video.play().catch(() => undefined);
  try {
    if (video.webkitEnterFullscreen) video.webkitEnterFullscreen();
    else if (video.requestFullscreen) void video.requestFullscreen().catch(() => undefined);
  } catch { /* Inline or dialog playback is the fallback. */ }
  return playing;
}