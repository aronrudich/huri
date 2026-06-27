import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";
import { Phone, StatusBar, HuriLogo } from "../../components/Phone";

export const Profile: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });

  // Toggle off at 90, back on at 150
  let on = true;
  if (frame >= 90 && frame < 150) on = false;

  const knobX = on ? 28 : 4;

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #1a2548 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 90,
    }}>
      <div style={{ flex: 1, maxWidth: 580, paddingLeft: 100, opacity: enter }}>
        <p style={{ fontSize: 54, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: 0, lineHeight: 1.05 }}>
          Profile.
        </p>
        <p style={{ fontSize: 24, color: "#9BB0E0", margin: "20px 0 0", lineHeight: 1.4 }}>
          Update your info. Toggle notifications off when you're not on shift.
        </p>
      </div>

      <div style={{ opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [60, 0])}px)` }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 16px" }}>
            <HuriLogo />
            <p style={{ margin: "12px 0 0", fontSize: 24, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>Profile</p>
          </div>
          <div style={{ background: "#fff", flex: 1, padding: "10px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "10px 0" }}>
              <div style={{ width: 70, height: 70, borderRadius: "50%", background: COLORS.primary, color: "#fff", display: "grid", placeItems: "center", fontSize: 28, fontWeight: 800 }}>MR</div>
              <div>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.text }}>Mike R.</p>
                <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>Advisor</p>
              </div>
            </div>

            <Field label="Email" value="mike@dealer.com" />
            <Field label="Role" value="Advisor" />

            <div style={{
              marginTop: 10, padding: "16px 18px",
              background: "#F1F4FB", borderRadius: 14,
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div>
                <p style={{ margin: 0, fontSize: 16, fontWeight: 700, color: COLORS.text }}>Notifications</p>
                <p style={{ margin: "2px 0 0", fontSize: 13, color: COLORS.mute }}>{on ? "On" : "Off — quiet mode"}</p>
              </div>
              <div style={{
                width: 60, height: 32, borderRadius: 999,
                background: on ? COLORS.primary : "#C9D0DD",
                position: "relative",
                boxShadow: on ? `0 0 16px ${COLORS.primary}55` : "none",
              }}>
                <div style={{
                  position: "absolute", top: 4, left: knobX,
                  width: 24, height: 24, borderRadius: "50%", background: "#fff",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                }} />
              </div>
            </div>
          </div>
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

const Field: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p style={{ margin: "0 0 4px", fontSize: 12, fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
    <div style={{ background: "#F1F4FB", borderRadius: 12, padding: "12px 14px", fontSize: 17, fontWeight: 600, color: COLORS.text }}>{value}</div>
  </div>
);
