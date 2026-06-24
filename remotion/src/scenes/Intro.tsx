import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 120 } });
  const tag = spring({ frame: frame - 20, fps, config: { damping: 18 } });
  const drift = interpolate(frame, [0, 90], [0, -20]);

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(1200px 800px at 30% 30%, #1a2a55 0%, ${COLORS.surface} 60%)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
    }}>
      {/* Floating accent shapes */}
      <div style={{ position: "absolute", top: 100 + drift, right: 200, width: 280, height: 280, borderRadius: "50%", background: COLORS.primary, opacity: 0.15, filter: "blur(40px)" }} />
      <div style={{ position: "absolute", bottom: 120 - drift, left: 180, width: 220, height: 220, borderRadius: "50%", background: COLORS.amber, opacity: 0.1, filter: "blur(40px)" }} />

      <div style={{
        display: "flex", alignItems: "center", gap: 28,
        transform: `scale(${interpolate(logo, [0, 1], [0.7, 1])})`, opacity: logo,
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: 38, background: COLORS.primary,
          display: "grid", placeItems: "center", fontSize: 92, fontWeight: 800, color: "#fff",
          fontFamily: "Space Grotesk", boxShadow: "0 24px 64px rgba(47,107,255,0.4)",
        }}>H</div>
        <span style={{ fontSize: 180, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", letterSpacing: -6 }}>huri</span>
      </div>
      <p style={{
        marginTop: 36, fontSize: 38, color: "#9BB0E0", fontWeight: 500, opacity: tag,
        transform: `translateY(${interpolate(tag, [0, 1], [20, 0])}px)`, fontFamily: "Inter",
      }}>
        the all-in-one app for service drives
      </p>
    </AbsoluteFill>
  );
};
