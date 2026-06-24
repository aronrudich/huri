import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Phone, StatusBar, HuriLogo } from "../components/Phone";
import { Caption } from "../components/Caption";

const cards = [
  { ro: "284715", spot: "12", model: "Jeep Wrangler", advisor: "Mike R.", warn: null, blocked: null },
  { ro: "284702", spot: "6",  model: "Ram 1500",     advisor: "Sarah K.", warn: "Nonstarter — dead battery", blocked: null },
  { ro: "284698", spot: "3",  model: "Dodge Charger", advisor: "Jen P.",  warn: null, blocked: "Spot 4 (Chrysler Pacifica)" },
];

export const Queue: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const phoneIn = spring({ frame, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #1a1230 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 80,
    }}>
      <div style={{ opacity: phoneIn, transform: `translateY(${interpolate(phoneIn, [0, 1], [40, 0])}px)` }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 12px" }}>
            <HuriLogo />
            <p style={{ margin: "12px 0 0", fontSize: 26, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>Pickup queue</p>
            <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>3 unclaimed</p>
          </div>
          <div style={{ background: "#EDF1F8", flex: 1, padding: "10px 14px", display: "flex", flexDirection: "column", gap: 12, overflow: "hidden" }}>
            {cards.map((c, i) => {
              const s = spring({ frame: frame - 20 - i * 18, fps, config: { damping: 18 } });
              return (
                <div key={i} style={{
                  background: "#fff", borderRadius: 18, overflow: "hidden",
                  opacity: s, transform: `translateY(${interpolate(s, [0, 1], [40, 0])}px)`,
                  boxShadow: "0 4px 12px rgba(0,0,0,0.04)",
                }}>
                  {c.warn && (
                    <div style={{ background: COLORS.warnBg, padding: "10px 16px", display: "flex", gap: 10, alignItems: "center" }}>
                      <span style={{ fontSize: 18 }}>⚠️</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#8A6B1F" }}>{c.warn}</span>
                    </div>
                  )}
                  <div style={{ padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <p style={{ margin: 0, fontSize: 19, fontWeight: 700, color: COLORS.text }}>RO #{c.ro}</p>
                        <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>{c.model} · {c.advisor}</p>
                      </div>
                      <span style={{ background: "#EDF1F8", color: COLORS.mute, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600 }}>2m ago</span>
                    </div>
                    <div style={{ marginTop: 10, background: COLORS.soft, borderRadius: 10, padding: "10px 12px", fontSize: 14 }}>
                      <p style={{ margin: 0, color: COLORS.text }}>Parked at: <b>Spot {c.spot}</b></p>
                      {c.blocked && (
                        <p style={{ margin: "4px 0 0", color: COLORS.mute, fontSize: 13 }}>
                          <b style={{ color: COLORS.text }}>Blocked by:</b> {c.blocked}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Phone>
      </div>

      {/* Right side callouts */}
      <div style={{ display: "flex", flexDirection: "column", gap: 28, maxWidth: 560 }}>
        {[
          { icon: "📍", title: "Spot location", desc: "Valets see exactly where to go" },
          { icon: "⚠️", title: "Nonstarter flag", desc: "Bring a jump box, not just keys" },
          { icon: "🚧", title: "Blocked-in warning", desc: "Move the right car first" },
        ].map((it, i) => {
          const s = spring({ frame: frame - 50 - i * 25, fps, config: { damping: 16 } });
          return (
            <div key={i} style={{
              display: "flex", gap: 22, alignItems: "flex-start",
              opacity: s, transform: `translateX(${interpolate(s, [0, 1], [60, 0])}px)`,
            }}>
              <div style={{ fontSize: 48 }}>{it.icon}</div>
              <div>
                <p style={{ margin: 0, fontSize: 36, fontWeight: 700, color: "#fff", fontFamily: "Space Grotesk" }}>{it.title}</p>
                <p style={{ margin: "4px 0 0", fontSize: 22, color: "#9BB0E0" }}>{it.desc}</p>
              </div>
            </div>
          );
        })}
      </div>

      <Caption text="Spots, nonstarters, blocked-in warnings — all at a glance." delay={10} />
    </AbsoluteFill>
  );
};
