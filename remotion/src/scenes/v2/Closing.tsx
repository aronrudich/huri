import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";

const lines = ["One trip.", "The right keys.", "The right car."];

export const Closing: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 150, fps, config: { damping: 14 } });
  const url = spring({ frame: frame - 200, fps, config: { damping: 18 } });
  const tagline = spring({ frame: frame - 240, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(1400px 900px at 70% 70%, #1e2f66 0%, ${COLORS.surface} 60%)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 26,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
        {lines.map((l, i) => {
          const s = spring({ frame: frame - i * 30, fps, config: { damping: 16 } });
          return (
            <p key={i} style={{
              margin: 0, fontSize: 78, fontWeight: 800, color: "#fff",
              fontFamily: "Space Grotesk", letterSpacing: -2,
              opacity: s, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
            }}>{l}</p>
          );
        })}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 24, marginTop: 30,
        opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.8, 1])})`,
      }}>
        <div style={{
          width: 110, height: 110, borderRadius: 28, background: COLORS.primary,
          display: "grid", placeItems: "center", fontSize: 76, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk",
        }}>H</div>
        <span style={{ fontSize: 140, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", letterSpacing: -5 }}>huri</span>
      </div>

      <p style={{
        margin: "8px 0 0", fontSize: 28, color: "#9BB0E0", fontWeight: 500,
        opacity: tagline, transform: `translateY(${interpolate(tagline, [0, 1], [16, 0])}px)`,
      }}>Built for the service drive.</p>

      <p style={{
        margin: "12px 0 0", fontSize: 28, color: COLORS.primary, fontWeight: 600, letterSpacing: 1,
        opacity: url, transform: `translateY(${interpolate(url, [0, 1], [16, 0])}px)`,
      }}>huri.lovable.app</p>
    </AbsoluteFill>
  );
};
