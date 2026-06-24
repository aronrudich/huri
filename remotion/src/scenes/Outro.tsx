import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

const lines = ["Faster pickups.", "Less chaos.", "Happier customers."];

export const Outro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame: frame - 70, fps, config: { damping: 14 } });
  const url = spring({ frame: frame - 110, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(1200px 800px at 70% 70%, #1e2f66 0%, ${COLORS.surface} 60%)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 30,
    }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
        {lines.map((l, i) => {
          const s = spring({ frame: frame - i * 14, fps, config: { damping: 16 } });
          return (
            <p key={i} style={{
              margin: 0, fontSize: 84, fontWeight: 800, color: "#fff",
              fontFamily: "Space Grotesk", letterSpacing: -2,
              opacity: s, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
            }}>{l}</p>
          );
        })}
      </div>

      <div style={{
        display: "flex", alignItems: "center", gap: 22, marginTop: 36,
        opacity: logo, transform: `scale(${interpolate(logo, [0, 1], [0.8, 1])})`,
      }}>
        <div style={{
          width: 96, height: 96, borderRadius: 26, background: COLORS.primary,
          display: "grid", placeItems: "center", fontSize: 64, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk",
        }}>H</div>
        <span style={{ fontSize: 128, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", letterSpacing: -4 }}>huri</span>
      </div>

      <p style={{
        margin: "20px 0 0", fontSize: 32, color: COLORS.primary, fontWeight: 600, letterSpacing: 1,
        opacity: url, transform: `translateY(${interpolate(url, [0, 1], [16, 0])}px)`,
      }}>huri.lovable.app</p>
    </AbsoluteFill>
  );
};
