import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";
import { Phone, StatusBar, HuriLogo } from "../../components/Phone";

export const CarTab: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 16 } });
  const pushIn = spring({ frame: frame - 100, fps, config: { damping: 12 } });
  const ripple = interpolate(frame - 100, [0, 60], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #142046 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 80,
    }}>
      <div style={{ opacity: phoneIn, transform: `translateX(${interpolate(phoneIn, [0, 1], [-60, 0])}px)`, position: "relative" }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 12px" }}>
            <HuriLogo />
            <p style={{ margin: "12px 0 0", fontSize: 26, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>Pickup queue</p>
            <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>3 unclaimed</p>
          </div>
          <div style={{ background: "#EDF1F8", flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { ro: "284715", spot: "12", model: "Jeep Wrangler" },
              { ro: "284702", spot: "6", model: "Ram 1500" },
              { ro: "284698", spot: "3", model: "Dodge Charger" },
            ].map((c, i) => (
              <div key={i} style={{ background: "#fff", borderRadius: 16, padding: "14px 16px", boxShadow: "0 4px 12px rgba(0,0,0,0.04)" }}>
                <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>RO #{c.ro}</p>
                <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>{c.model} · Spot {c.spot}</p>
              </div>
            ))}
          </div>
        </Phone>

        {/* Push notification dropping in */}
        <div style={{
          position: "absolute", top: 70, left: "50%",
          transform: `translateX(-50%) translateY(${interpolate(pushIn, [0, 1], [-160, 0])}px) scale(${interpolate(pushIn, [0, 1], [0.9, 1])})`,
          opacity: pushIn,
          width: 400, background: "rgba(255,255,255,0.97)", borderRadius: 22,
          padding: "16px 20px", boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: COLORS.primary, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800 }}>H</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 14, color: COLORS.text }}>HURI</p>
              <span style={{ fontSize: 12, color: COLORS.mute }}>now</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: COLORS.text }}>New pickup request</p>
            <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>RO #284715 · Spot 12</p>
          </div>
        </div>

        {/* Ripple */}
        {ripple > 0 && ripple < 1 && (
          <div style={{
            position: "absolute", top: 130, left: "50%",
            transform: `translateX(-50%) scale(${interpolate(ripple, [0, 1], [1, 3])})`,
            width: 200, height: 200, borderRadius: "50%",
            border: `3px solid ${COLORS.primary}`,
            opacity: interpolate(ripple, [0, 1], [0.6, 0]),
            pointerEvents: "none",
          }} />
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 600, opacity: phoneIn }}>
        <p style={{ fontSize: 60, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: 0, lineHeight: 1.05, letterSpacing: -1.5 }}>
          One tap.<br />Every valet knows.
        </p>
        <p style={{ fontSize: 28, color: "#9BB0E0", margin: 0, lineHeight: 1.4 }}>
          When an advisor or technician submits a pickup, every valet's phone lights up instantly.
        </p>
      </div>
    </AbsoluteFill>
  );
};
