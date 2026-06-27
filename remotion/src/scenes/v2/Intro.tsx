import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";

export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const logo = spring({ frame, fps, config: { damping: 14, stiffness: 110 } });
  const tag = spring({ frame: frame - 28, fps, config: { damping: 20 } });
  const drift = interpolate(frame, [0, 150], [0, -30]);

  return (
    <AbsoluteFill style={{
      background: `radial-gradient(1400px 900px at 30% 30%, #1a2a55 0%, ${COLORS.surface} 65%)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
    }}>
      <div style={{ position: "absolute", top: 100 + drift, right: 200, width: 320, height: 320, borderRadius: "50%", background: COLORS.primary, opacity: 0.18, filter: "blur(50px)" }} />
      <div style={{ position: "absolute", bottom: 120 - drift, left: 180, width: 260, height: 260, borderRadius: "50%", background: COLORS.amber, opacity: 0.12, filter: "blur(50px)" }} />

      <div style={{
        display: "flex", alignItems: "center", gap: 32,
        transform: `scale(${interpolate(logo, [0, 1], [0.7, 1])})`, opacity: logo,
      }}>
        <div style={{
          width: 160, height: 160, borderRadius: 42, background: COLORS.primary,
          display: "grid", placeItems: "center", fontSize: 104, fontWeight: 800, color: "#fff",
          fontFamily: "Space Grotesk", boxShadow: "0 28px 70px rgba(47,107,255,0.45)",
        }}>H</div>
        <span style={{ fontSize: 200, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", letterSpacing: -7 }}>huri</span>
      </div>
      <p style={{
        marginTop: 44, fontSize: 42, color: "#9BB0E0", fontWeight: 500, opacity: tag,
        transform: `translateY(${interpolate(tag, [0, 1], [20, 0])}px)`, fontFamily: "Inter", textAlign: "center", maxWidth: 1400,
      }}>
        built for dealership service departments
      </p>
      <p style={{
        marginTop: 14, fontSize: 26, color: "#6E80B0", fontWeight: 400, opacity: tag, fontFamily: "Inter",
      }}>
        valets · advisors · technicians
      </p>
    </AbsoluteFill>
  );
};
