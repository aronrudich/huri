import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";
import { Phone, StatusBar, HuriLogo } from "../../components/Phone";

const rows = [
  { spot: "1", ro: "284711", model: "Ram 1500" },
  { spot: "2", ro: "284709", model: "Jeep Grand Cherokee" },
  { spot: "3", ro: "284698", model: "Dodge Charger" },
  { spot: "4", ro: "284720", model: "Chrysler Pacifica" },
  { spot: "5", ro: "284715", model: "Jeep Wrangler" },
  { spot: "6", ro: "284702", model: "Ram 1500" },
  { spot: "7", ro: "284731", model: "Jeep Compass" },
  { spot: "8", ro: "—", model: "(empty)" },
  { spot: "9", ro: "284742", model: "Fiat 500" },
  { spot: "10", ro: "284755", model: "Dodge Durango" },
];

export const Lot: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });

  const scroll = interpolate(frame, [60, 180], [0, -160], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #142046 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 90,
    }}>
      <div style={{ flex: 1, maxWidth: 620, paddingLeft: 100, opacity: enter }}>
        <p style={{ fontSize: 56, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: 0, lineHeight: 1.05 }}>
          Every spot.<br />Every car.
        </p>
        <p style={{ fontSize: 24, color: "#9BB0E0", margin: "20px 0 0", lineHeight: 1.4 }}>
          Tap any spot to see the car's details — or update it.
        </p>
      </div>

      <div style={{ opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [60, 0])}px)` }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 12px" }}>
            <HuriLogo />
            <p style={{ margin: "10px 0 0", fontSize: 22, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>Lot</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: COLORS.mute }}>147 spots</p>
          </div>
          <div style={{ background: "#EDF1F8", flex: 1, overflow: "hidden", position: "relative" }}>
            <div style={{ transform: `translateY(${scroll}px)`, padding: "10px 14px" }}>
              {rows.map((r, i) => (
                <div key={i} style={{
                  background: "#fff", borderRadius: 14, padding: "12px 14px", marginBottom: 8,
                  display: "flex", alignItems: "center", gap: 14,
                  boxShadow: "0 3px 8px rgba(0,0,0,0.03)",
                }}>
                  <div style={{
                    width: 50, height: 50, borderRadius: 10,
                    background: r.ro === "—" ? "#EDF1F8" : "rgba(47,107,255,0.12)",
                    color: r.ro === "—" ? COLORS.mute : COLORS.primary,
                    display: "grid", placeItems: "center", fontWeight: 800, fontSize: 20, fontFamily: "Space Grotesk",
                  }}>{r.spot}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: COLORS.text }}>{r.ro !== "—" ? `RO #${r.ro}` : "Empty"}</p>
                    <p style={{ margin: "2px 0 0", fontSize: 13, color: COLORS.mute }}>{r.model}</p>
                  </div>
                  <span style={{ color: COLORS.mute, fontSize: 18 }}>›</span>
                </div>
              ))}
            </div>
          </div>
        </Phone>
      </div>
    </AbsoluteFill>
  );
};
