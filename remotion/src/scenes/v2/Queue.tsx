import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";
import { Phone, StatusBar, HuriLogo } from "../../components/Phone";

export const Queue: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });

  // Tap claim around frame 140; status flips and card drops at 170
  const tapScale = interpolate(frame, [140, 150, 160], [1, 0.94, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const flipped = frame >= 160;
  const drop = interpolate(frame, [180, 230], [0, 220], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const cards = [
    { ro: "284715", spot: "12", model: "Jeep Wrangler", time: "12m" },
    { ro: "284702", spot: "6", model: "Ram 1500", time: "8m" },
    { ro: "284698", spot: "3", model: "Dodge Charger", time: "5m" },
  ];

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #142046 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 80,
    }}>
      <div style={{ flex: 1, maxWidth: 620, paddingLeft: 100, opacity: enter }}>
        <p style={{ fontSize: 56, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: 0, lineHeight: 1.05 }}>
          Oldest pickups<br />on top.
        </p>
        <p style={{ fontSize: 24, color: "#9BB0E0", margin: "20px 0 0", lineHeight: 1.4 }}>
          Tap <b style={{ color: "#fff" }}>Claim</b>, the status flips to <b style={{ color: COLORS.amber }}>In Progress</b>, and the card drops down the list.
        </p>
        <p style={{ fontSize: 20, color: "#6E80B0", margin: "16px 0 0", fontStyle: "italic" }}>
          Completed pickups disappear automatically.
        </p>
      </div>

      <div style={{ opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [60, 0])}px) scale(${tapScale})` }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 10px" }}>
            <HuriLogo />
            <p style={{ margin: "10px 0 0", fontSize: 24, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>Pickup queue</p>
          </div>
          <div style={{ background: "#EDF1F8", flex: 1, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10, position: "relative" }}>
            {cards.map((c, i) => {
              const isTop = i === 0;
              return (
                <div key={i} style={{
                  background: "#fff", borderRadius: 16, padding: "14px 16px",
                  boxShadow: isTop ? `0 10px 26px rgba(47,107,255,0.25)` : "0 4px 12px rgba(0,0,0,0.04)",
                  border: isTop && !flipped ? `2px solid ${COLORS.primary}` : "2px solid transparent",
                  transform: isTop ? `translateY(${drop}px)` : "translateY(0)",
                  opacity: isTop && drop > 180 ? interpolate(drop, [180, 220], [1, 0.7]) : 1,
                  zIndex: isTop ? 2 : 1,
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <p style={{ margin: 0, fontSize: 18, fontWeight: 700, color: COLORS.text }}>RO #{c.ro}</p>
                    <span style={{ fontSize: 12, color: COLORS.mute, fontWeight: 600 }}>{c.time} ago</span>
                  </div>
                  <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>{c.model} · Spot {c.spot}</p>
                  {isTop && (
                    <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                      <div style={{
                        flex: 1, padding: "10px 0", borderRadius: 10, textAlign: "center",
                        fontWeight: 700, fontSize: 14,
                        background: flipped ? COLORS.amberSoft : COLORS.primary,
                        color: flipped ? "#8A6B1F" : "#fff",
                      }}>{flipped ? "● In Progress" : "Claim"}</div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Phone>
      </div>
    </AbsoluteFill>
  );
};
