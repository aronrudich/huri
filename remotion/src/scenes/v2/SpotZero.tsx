import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";

export const SpotZero: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 18 } });

  // Car leaves spot 12 around frame 50, hits spot 0 by 110, returns to spot 14 by 200
  const carX = interpolate(frame, [50, 110, 160, 220], [0, 320, 320, 640], {
    extrapolateLeft: "clamp", extrapolateRight: "clamp",
  });
  const spot12Empty = frame > 80;
  const showZero = frame > 100 && frame < 180;
  const showNewSpot = frame > 200;

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #1a1230 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 50,
    }}>
      <div style={{ opacity: enter, textAlign: "center" }}>
        <p style={{ fontSize: 50, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: 0, lineHeight: 1.05 }}>
          Moving a car? Set the spot to <span style={{ color: COLORS.amber }}>0</span>.
        </p>
        <p style={{ fontSize: 22, color: "#9BB0E0", margin: "16px 0 0" }}>
          When it returns, whoever parks it enters the new spot.
        </p>
      </div>

      {/* Three spot boxes: Spot 12 → Spot 0 → Spot 14 */}
      <div style={{ display: "flex", gap: 80, alignItems: "center", marginTop: 20, position: "relative" }}>
        <SpotCard num="12" empty={spot12Empty} label="WAS PARKED" />
        <div style={{ fontSize: 44, color: COLORS.mute }}>→</div>
        <SpotCard num="0" active={showZero} label="OFF THE LOT" amber />
        <div style={{ fontSize: 44, color: COLORS.mute }}>→</div>
        <SpotCard num="14" active={showNewSpot} label="NEW SPOT" />

        {/* Moving car */}
        {frame > 40 && frame < 240 && (
          <div style={{
            position: "absolute",
            left: -60 + carX, top: -80,
            fontSize: 68,
            transition: "none",
          }}>🚗</div>
        )}
      </div>
    </AbsoluteFill>
  );
};

const SpotCard: React.FC<{ num: string; empty?: boolean; active?: boolean; label: string; amber?: boolean }> = ({ num, empty, active, label, amber }) => {
  const color = amber ? COLORS.amber : COLORS.primary;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: "#6E80B0", letterSpacing: 2 }}>{label}</span>
      <div style={{
        width: 180, height: 140, borderRadius: 18,
        border: `3px solid ${active || (!empty && num !== "0") ? color : "#2a3553"}`,
        background: active ? `${color}22` : "transparent",
        display: "grid", placeItems: "center", position: "relative",
        boxShadow: active ? `0 0 30px ${color}55` : "none",
      }}>
        <span style={{ position: "absolute", top: 8, left: 12, fontSize: 14, fontWeight: 700, color: "#6E80B0" }}>SPOT</span>
        <span style={{ fontSize: 64, fontWeight: 800, color: active ? color : "#3a4a72", fontFamily: "Space Grotesk" }}>{num}</span>
      </div>
    </div>
  );
};
