import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../theme";
import { Phone, StatusBar, HuriLogo } from "../components/Phone";
import { Caption } from "../components/Caption";

export const Pickup: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const advisorIn = spring({ frame, fps, config: { damping: 18 } });
  const tap = spring({ frame: frame - 40, fps, config: { damping: 10, stiffness: 200 } });
  const tapScale = interpolate(tap, [0, 0.5, 1], [1, 0.92, 1]);
  const flyOut = spring({ frame: frame - 60, fps, config: { damping: 20 } });
  const valetIn = spring({ frame: frame - 50, fps, config: { damping: 18 } });
  const pushIn = spring({ frame: frame - 90, fps, config: { damping: 12 } });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, #0d1428 0%, ${COLORS.surface} 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 80,
    }}>
      {/* Advisor phone (left) */}
      <div style={{
        opacity: advisorIn,
        transform: `translateX(${interpolate(advisorIn, [0, 1], [-60, 0])}px) scale(${tapScale})`,
      }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px" }}>
            <HuriLogo />
            <p style={{ margin: "16px 0 4px", fontSize: 28, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>New pickup</p>
          </div>
          <div style={{ background: "#fff", flex: 1, padding: "0 22px", display: "flex", flexDirection: "column", gap: 16 }}>
            <BigField label="RO #" value="284715" />
            <BigField label="Advisor" value="Mike R." />
            <BigField label="Model" value="Jeep Wrangler" />
            <div style={{ flex: 1 }} />
            <button style={{
              background: tap > 0.1 ? COLORS.success : COLORS.primary,
              color: "#fff", border: "none", borderRadius: 16,
              padding: "22px 0", fontSize: 22, fontWeight: 700, marginBottom: 28,
              boxShadow: `0 12px 30px ${(tap > 0.1 ? COLORS.success : COLORS.primary)}66`,
            }}>
              {tap > 0.5 ? "✓ Sent to valets" : "Request pickup"}
            </button>
          </div>
        </Phone>
      </div>

      {/* Flying signal */}
      {flyOut > 0.05 && flyOut < 0.95 && (
        <div style={{
          position: "absolute", top: "45%", left: `${interpolate(flyOut, [0, 1], [42, 56])}%`,
          transform: "translateY(-50%)", fontSize: 60, opacity: interpolate(flyOut, [0, 0.2, 0.8, 1], [0, 1, 1, 0]),
        }}>📡</div>
      )}

      {/* Valet phone (right) */}
      <div style={{
        opacity: valetIn,
        transform: `translateX(${interpolate(valetIn, [0, 1], [60, 0])}px)`,
        position: "relative",
      }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", gap: 20 }}>
            <p style={{ margin: 0, color: COLORS.mute, fontSize: 18 }}>Valet · standby</p>
            <p style={{ margin: 0, fontSize: 80, fontWeight: 800, color: COLORS.text, fontFamily: "Space Grotesk" }}>9:41</p>
          </div>
        </Phone>

        {/* Push notification */}
        <div style={{
          position: "absolute", top: 110, left: "50%",
          transform: `translateX(-50%) translateY(${interpolate(pushIn, [0, 1], [-120, 0])}px) scale(${interpolate(pushIn, [0, 1], [0.9, 1])})`,
          opacity: pushIn,
          width: 380, background: "rgba(255,255,255,0.95)", borderRadius: 22,
          padding: "16px 20px", boxShadow: "0 20px 50px rgba(0,0,0,0.4)",
          display: "flex", gap: 14, alignItems: "flex-start",
        }}>
          <div style={{ width: 44, height: 44, borderRadius: 10, background: COLORS.primary, display: "grid", placeItems: "center", color: "#fff", fontWeight: 800 }}>H</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <p style={{ margin: 0, fontWeight: 700, fontSize: 15, color: COLORS.text }}>HURI</p>
              <span style={{ fontSize: 12, color: COLORS.mute }}>now</span>
            </div>
            <p style={{ margin: "2px 0 0", fontSize: 16, fontWeight: 700, color: COLORS.text }}>New pickup request</p>
            <p style={{ margin: "2px 0 0", fontSize: 15, color: COLORS.mute }}>RO #284715 · Mike R.</p>
          </div>
        </div>
      </div>

      <Caption text="Advisors tap to request a pickup — every valet is notified instantly." delay={10} />
    </AbsoluteFill>
  );
};

const BigField: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div>
    <p style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
    <div style={{ background: "#F1F4FB", borderRadius: 12, padding: "16px 18px", fontSize: 22, fontWeight: 700, color: COLORS.text }}>{value}</div>
  </div>
);
