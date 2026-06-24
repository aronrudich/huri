import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Phone, StatusBar, HuriLogo } from "../components/Phone";
import { Caption } from "../components/Caption";

const ro = "284715";
const spot = "12";

export const Park: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });

  const roLen = Math.min(ro.length, Math.max(0, Math.floor((frame - 25) / 4)));
  const spotLen = Math.min(spot.length, Math.max(0, Math.floor((frame - 60) / 6)));
  const btn = spring({ frame: frame - 90, fps, config: { damping: 12 } });
  const success = spring({ frame: frame - 115, fps, config: { damping: 14 } });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #142046 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{ opacity: enter, transform: `scale(${interpolate(enter, [0, 1], [0.9, 1])})` }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 18px" }}>
            <HuriLogo />
            <p style={{ margin: "16px 0 4px", fontSize: 28, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>Park a car</p>
            <p style={{ margin: 0, fontSize: 15, color: COLORS.mute }}>Log where you dropped it</p>
          </div>
          <div style={{ background: "#fff", flex: 1, padding: "8px 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <Field label="RO Number" required value={ro.slice(0, roLen)} active={frame >= 20 && frame < 60} />
            <Field label="Spot Number" required value={spot.slice(0, spotLen)} active={frame >= 55 && frame < 90} />
            <Field label="Tag Number" value="" />
            <Field label="Car Model" value="" />
            <div style={{ flex: 1 }} />
            <button style={{
              background: COLORS.primary, color: "#fff", border: "none", borderRadius: 16,
              padding: "20px 0", fontSize: 20, fontWeight: 700, marginBottom: 28,
              transform: `scale(${interpolate(btn, [0, 1], [1, 1.04])})`,
              boxShadow: btn > 0.5 ? `0 12px 30px ${COLORS.primary}88` : "none",
            }}>
              {success > 0.5 ? "✓ Parked" : "Save"}
            </button>
          </div>
        </Phone>
      </div>

      <Caption text="Park a car in seconds — just the RO and the spot." delay={8} />
    </AbsoluteFill>
  );
};

const Field: React.FC<{ label: string; value: string; required?: boolean; active?: boolean }> = ({ label, value, required, active }) => (
  <div>
    <p style={{ margin: "0 0 6px", fontSize: 14, fontWeight: 600, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 1 }}>
      {label} {required && <span style={{ color: COLORS.primary }}>*</span>}
    </p>
    <div style={{
      background: "#F1F4FB", borderRadius: 12, padding: "16px 18px",
      fontSize: 22, fontWeight: 600, color: COLORS.text, minHeight: 30,
      border: active ? `2px solid ${COLORS.primary}` : "2px solid transparent",
    }}>
      {value || <span style={{ color: "#C9D0DD" }}>—</span>}
      {active && <span style={{ borderLeft: `2px solid ${COLORS.primary}`, marginLeft: 2, animation: "" }}>&nbsp;</span>}
    </div>
  </div>
);
