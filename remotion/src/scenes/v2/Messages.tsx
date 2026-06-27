import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";
import { Phone, StatusBar, HuriLogo } from "../../components/Phone";

const threads = [
  { name: "Mike R. (Advisor)", msg: "Need a tech on bay 4 — coolant leak", time: "2m", color: COLORS.primary },
  { name: "Valets (Group)", msg: "Move 4 cars off the front row before lunch", time: "5m", color: "#8A6B1F", bg: "#F1E9D9" },
  { name: "Sarah K. (Advisor)", msg: "Customer here for RO 284702", time: "8m", color: COLORS.primary },
  { name: "Technicians (Group)", msg: "Parts truck just pulled up", time: "14m", color: "#1F5E3A", bg: "#D9F0E2" },
  { name: "Jen P. (Valet)", msg: "Spot 14 cleared", time: "22m", color: COLORS.primary },
  { name: "Advisors (Group)", msg: "Standup at 4", time: "1h", color: "#7A2F8A", bg: "#EFDDF3" },
];

export const Messages: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });
  const chipsIn = spring({ frame: frame - 90, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, #0d1428 0%, ${COLORS.surface} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 100,
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
          <div style={{ background: "#fff", flex: 1, overflow: "hidden" }}>
            {threads.map((t, i) => {
              const tSpring = spring({ frame: frame - 18 - i * 9, fps, config: { damping: 20 } });
              const isGroup = t.name.includes("Group");
              return (
                <div key={i} style={{
                  display: "flex", gap: 14, padding: "14px 22px", borderBottom: "1px solid #EEF1F7",
                  opacity: tSpring, transform: `translateY(${interpolate(tSpring, [0, 1], [20, 0])}px)`,
                }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%",
                    background: isGroup ? (t.bg || "#F1E9D9") : "rgba(47,107,255,0.15)",
                    color: t.color,
                    display: "grid", placeItems: "center", fontSize: 18, fontWeight: 700,
                  }}>{isGroup ? "👥" : t.name[0]}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <p style={{ margin: 0, fontWeight: 700, fontSize: 16, color: COLORS.text }}>{t.name}</p>
                      <span style={{ fontSize: 12, color: COLORS.mute }}>{t.time}</span>
                    </div>
                    <p style={{ margin: "4px 0 0", fontSize: 15, color: COLORS.mute, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.msg}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Phone>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 24, opacity: chipsIn }}>
        <p style={{ fontSize: 52, fontWeight: 700, color: "#fff", fontFamily: "Space Grotesk", margin: 0, maxWidth: 560, lineHeight: 1.1 }}>
          Message anyone.<br />Or a whole group.
        </p>
        {[
          { label: "Valets", color: "#F5A524", bg: "rgba(245,165,36,0.15)" },
          { label: "Advisors", color: "#2F6BFF", bg: "rgba(47,107,255,0.18)" },
          { label: "Technicians", color: "#16A34A", bg: "rgba(22,163,74,0.18)" },
        ].map((r, i) => {
          const s = spring({ frame: frame - 110 - i * 14, fps, config: { damping: 14 } });
          return (
            <div key={r.label} style={{
              padding: "20px 36px", borderRadius: 999, background: r.bg,
              border: `2px solid ${r.color}`, color: "#fff", fontSize: 38, fontWeight: 600,
              opacity: s, transform: `translateX(${interpolate(s, [0, 1], [40, 0])}px) scale(${interpolate(s, [0, 1], [0.9, 1])})`,
              display: "flex", alignItems: "center", gap: 16,
            }}>
              <span style={{ width: 16, height: 16, borderRadius: "50%", background: r.color }} />
              {r.label}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
