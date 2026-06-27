import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";
import { Phone, StatusBar, HuriLogo } from "../../components/Phone";

/**
 * The hero scene: phone on left shows pickup card with "blocked by" callouts.
 * Right side shows a clean animated 3-deep row diagram with spots 1, 2, 3.
 * Cars in 1 & 2 light amber; spot 3 (target) pulses blue. Arrows show blocking order.
 */
export const Blocking: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const phoneIn = spring({ frame, fps, config: { damping: 18 } });
  const diagramIn = spring({ frame: frame - 90, fps, config: { damping: 18 } });

  const car1In = spring({ frame: frame - 180, fps, config: { damping: 16 } });
  const car2In = spring({ frame: frame - 230, fps, config: { damping: 16 } });
  const targetPulse = 1 + Math.sin((frame - 280) / 8) * 0.04;
  const showTarget = frame > 280;

  const arrow1 = interpolate(frame, [340, 400], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const arrow2 = interpolate(frame, [400, 460], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  const oneTripIn = spring({ frame: frame - 540, fps, config: { damping: 16 } });

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #1a1230 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 80, padding: "0 80px",
    }}>
      {/* Phone left */}
      <div style={{ opacity: phoneIn, transform: `translateX(${interpolate(phoneIn, [0, 1], [-60, 0])}px)` }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 12px" }}>
            <HuriLogo />
            <p style={{ margin: "12px 0 0", fontSize: 22, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>Pickup</p>
          </div>
          <div style={{ background: "#EDF1F8", flex: 1, padding: "14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>
            <div style={{ background: "#fff", borderRadius: 18, overflow: "hidden", boxShadow: "0 6px 16px rgba(0,0,0,0.06)" }}>
              <div style={{ padding: "16px 18px" }}>
                <p style={{ margin: 0, fontSize: 20, fontWeight: 700, color: COLORS.text }}>RO #284698</p>
                <p style={{ margin: "2px 0 0", fontSize: 15, color: COLORS.mute }}>Dodge Charger · Jen P.</p>
              </div>
              <div style={{ background: COLORS.soft, padding: "12px 18px", borderTop: "1px solid #E3E8F2" }}>
                <p style={{ margin: 0, fontSize: 15, color: COLORS.text }}>Parked at <b>Spot 3</b></p>
              </div>
              <div style={{ background: COLORS.amberSoft, padding: "12px 18px" }}>
                <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#8A6B1F", textTransform: "uppercase", letterSpacing: 1 }}>⚠ Blocked by</p>
                <p style={{ margin: "6px 0 0", fontSize: 15, color: COLORS.text }}>Spot 1 — RO #284711 (Ram 1500)</p>
                <p style={{ margin: "2px 0 0", fontSize: 15, color: COLORS.text }}>Spot 2 — RO #284709 (Jeep Grand Cherokee)</p>
              </div>
              <div style={{ padding: "14px 18px", display: "flex", gap: 10 }}>
                <div style={{ flex: 1, background: COLORS.primary, color: "#fff", padding: "12px 0", borderRadius: 12, textAlign: "center", fontWeight: 700, fontSize: 15 }}>Claim</div>
              </div>
            </div>
          </div>
        </Phone>
      </div>

      {/* Diagram right */}
      <div style={{ flex: 1, maxWidth: 760, opacity: diagramIn }}>
        <p style={{ fontSize: 44, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: "0 0 12px", lineHeight: 1.05 }}>
          The lot is three deep.
        </p>
        <p style={{ fontSize: 22, color: "#9BB0E0", margin: "0 0 36px" }}>
          Spot 1 in front, 2 in the middle, 3 in back.
        </p>

        {/* Row diagram */}
        <div style={{ display: "flex", gap: 18, alignItems: "center" }}>
          <SpotBox num={1} label="FRONT" filled={car1In} color={COLORS.amber} />
          <Arrow visible={arrow1} />
          <SpotBox num={2} label="MIDDLE" filled={car2In} color={COLORS.amber} />
          <Arrow visible={arrow2} />
          <SpotBox num={3} label="BACK" filled={showTarget ? 1 : 0} color={COLORS.primary} pulse={showTarget ? targetPulse : 1} target />
        </div>

        <p style={{ fontSize: 18, color: "#6E80B0", margin: "20px 0 0", fontStyle: "italic" }}>
          Cars in 1 and 2 block the car in 3.
        </p>

        <div style={{
          marginTop: 40, opacity: oneTripIn,
          transform: `translateY(${interpolate(oneTripIn, [0, 1], [20, 0])}px)`,
          padding: "22px 28px", borderRadius: 18,
          background: "rgba(47,107,255,0.12)", border: `2px solid ${COLORS.primary}`,
          display: "flex", alignItems: "center", gap: 18,
        }}>
          <div style={{ fontSize: 44 }}>🗝️</div>
          <div>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 700, color: "#fff", fontFamily: "Space Grotesk" }}>One trip. All the right keys.</p>
            <p style={{ margin: "4px 0 0", fontSize: 18, color: "#9BB0E0" }}>Not three.</p>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const SpotBox: React.FC<{ num: number; label: string; filled: number; color: string; pulse?: number; target?: boolean }> = ({ num, label, filled, color, pulse = 1, target }) => (
  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, transform: `scale(${pulse})` }}>
    <span style={{ fontSize: 12, fontWeight: 700, color: "#6E80B0", letterSpacing: 2 }}>{label}</span>
    <div style={{
      width: 150, height: 110, borderRadius: 14,
      border: `3px solid ${filled > 0.2 ? color : "#2a3553"}`,
      background: filled > 0.2 ? `${color}33` : "transparent",
      display: "grid", placeItems: "center", position: "relative",
      transition: "all 0.2s",
      boxShadow: target && filled > 0.5 ? `0 0 30px ${color}66` : "none",
    }}>
      <span style={{ position: "absolute", top: 6, left: 10, fontSize: 14, fontWeight: 700, color: "#6E80B0" }}>{num}</span>
      {filled > 0.3 && (
        <span style={{ fontSize: 56, opacity: filled }}>🚗</span>
      )}
    </div>
  </div>
);

const Arrow: React.FC<{ visible: number }> = ({ visible }) => (
  <div style={{ fontSize: 38, color: COLORS.amber, opacity: visible, transform: `translateX(${interpolate(visible, [0, 1], [-10, 0])}px)` }}>→</div>
);
