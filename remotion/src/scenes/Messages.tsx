import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Phone, StatusBar, HuriLogo } from "../components/Phone";
import { Caption } from "../components/Caption";

const threads = [
  { name: "Mike (Service)", msg: "Need a tech on bay 4 — coolant leak", time: "2m", dm: true },
  { name: "Valets (broadcast)", msg: "Move 4 cars off the front row before lunch", time: "5m", dm: false },
  { name: "Sarah (Sales)", msg: "Demo plates back?", time: "12m", dm: true },
  { name: "Service (broadcast)", msg: "All-hands huddle at 4pm", time: "1h", dm: false },
];

export const Messages: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, #0d1428 0%, ${COLORS.surface} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 80,
    }}>
      <div style={{
        opacity: enter,
        transform: `translateX(${interpolate(enter, [0, 1], [-60, 0])}px)`,
      }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 18px" }}>
            <HuriLogo />
            <div style={{ marginTop: 14, background: "#EAEEF6", borderRadius: 12, padding: "12px 14px", color: COLORS.mute, fontSize: 16 }}>🔍 Search</div>
          </div>
          <div style={{ background: "#fff", flex: 1 }}>
            {threads.map((t, i) => {
              const tSpring = spring({ frame: frame - 15 - i * 10, fps, config: { damping: 20 } });
              return (
                <div key={i} style={{
                  display: "flex", gap: 14, padding: "16px 22px", borderBottom: "1px solid #EEF1F7",
                  opacity: tSpring, transform: `translateY(${interpolate(tSpring, [0, 1], [20, 0])}px)`,
                }}>
                  <div style={{
                    width: 46, height: 46, borderRadius: "50%",
                    background: t.dm ? "rgba(47,107,255,0.15)" : "#F1E9D9",
                    color: t.dm ? COLORS.primary : "#8A6B1F",
                    display: "grid", placeItems: "center", fontSize: 20, fontWeight: 700,
                  }}>{t.dm ? t.name[0] : "👥"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 18, color: COLORS.text }}>{t.name}</p>
                      <span style={{ fontSize: 13, color: COLORS.mute }}>{t.time}</span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 16, color: COLORS.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.msg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Phone>
      </div>

      {/* Role chips floating */}
      <div style={{ display: "flex", flexDirection: "column", gap: 22, opacity: enter }}>
        <p style={{ fontSize: 48, fontWeight: 700, color: "#fff", fontFamily: "Space Grotesk", margin: 0 }}>Broadcast to a role</p>
        {["Service", "Sales", "Valets", "Managers"].map((r, i) => {
          const s = spring({ frame: frame - 40 - i * 12, fps, config: { damping: 14 } });
          return (
            <div key={r} style={{
              padding: "18px 32px", borderRadius: 999, background: "rgba(47,107,255,0.18)",
              border: `2px solid ${COLORS.primary}`, color: "#fff", fontSize: 32, fontWeight: 600,
              opacity: s, transform: `translateX(${interpolate(s, [0, 1], [40, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
              display: "flex", alignItems: "center", gap: 14,
            }}>
              <span style={{ width: 14, height: 14, borderRadius: "50%", background: COLORS.primary }} />
              {r}
            </div>
          );
        })}
      </div>

      <Caption text="Direct message anyone — or broadcast to an entire role." delay={10} />
    </AbsoluteFill>
  );
};
