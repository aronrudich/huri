import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";

/**
 * "The problem today": stylized top-down lot diagram with tiny valet figure
 * walking back and forth — amber accents for wasted trips.
 */
export const Problem: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });

  // Phases: walk to lot1 (40-110), find blocked (110-160), walk back (160-230),
  // walk to lot2 (230-310), back to lot1 (310-400), arrive (400-450)
  const figureX = interpolate(
    frame,
    [40, 110, 160, 230, 310, 400, 450, 510],
    [60, 540, 540, 60, 980, 60, 540, 540],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );

  const showBlocked = frame > 110 && frame < 220;
  const counter = Math.min(3, Math.max(0, Math.floor((frame - 80) / 110)));

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, #2a1810 0%, ${COLORS.surface} 100%)`,
      display: "flex", flexDirection: "column", padding: "60px 80px",
    }}>
      <div style={{ opacity: enter, marginBottom: 30 }}>
        <p style={{ fontSize: 60, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: 0, lineHeight: 1.05 }}>
          Today, pickups take <span style={{ color: COLORS.amber }}>too long.</span>
        </p>
        <p style={{ fontSize: 22, color: "#C9A47F", margin: "12px 0 0" }}>
          Valets cross the street. Find a car blocked in. Walk back for more keys. Walk back again.
        </p>
      </div>

      {/* Top-down "two lots split by a street" diagram */}
      <div style={{ position: "relative", flex: 1, background: "rgba(255,255,255,0.03)", borderRadius: 24, overflow: "hidden", border: "1px solid rgba(245,165,36,0.2)" }}>
        {/* Lot 1 (left) */}
        <LotBlock x={40} y={60} label="LOT A" />
        {/* Street */}
        <div style={{ position: "absolute", left: 460, top: 40, bottom: 40, width: 80, background: "repeating-linear-gradient(to bottom, #2a3553 0 30px, transparent 30px 50px)", opacity: 0.6 }} />
        <span style={{ position: "absolute", left: 472, top: 50, fontSize: 11, color: "#6E80B0", letterSpacing: 2, fontWeight: 700, writingMode: "vertical-rl" }}>STREET</span>
        {/* Lot 2 (right) */}
        <LotBlock x={580} y={60} label="LOT B" />
        {/* Key station */}
        <div style={{
          position: "absolute", right: 60, bottom: 60,
          padding: "10px 16px", background: "rgba(47,107,255,0.18)", border: `2px solid ${COLORS.primary}`,
          borderRadius: 10, color: "#fff", fontWeight: 700, fontSize: 14,
        }}>🗝️ Key station</div>

        {/* Walking figure */}
        <div style={{
          position: "absolute", left: figureX, top: 200,
          fontSize: 42,
        }}>🏃</div>

        {/* Blocked alert */}
        {showBlocked && (
          <div style={{
            position: "absolute", left: 460, top: 130,
            padding: "10px 16px", background: COLORS.amberSoft, border: `2px solid ${COLORS.amber}`,
            borderRadius: 10, color: "#8A6B1F", fontWeight: 700, fontSize: 14,
          }}>⚠ Blocked in!</div>
        )}

        {/* Wasted-trip counter */}
        <div style={{
          position: "absolute", left: 40, bottom: 40,
          padding: "12px 18px", background: "rgba(245,165,36,0.15)", border: `2px solid ${COLORS.amber}`,
          borderRadius: 12,
        }}>
          <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: COLORS.amber, letterSpacing: 2 }}>WASTED TRIPS</p>
          <p style={{ margin: "4px 0 0", fontSize: 38, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", lineHeight: 1 }}>{counter}</p>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const LotBlock: React.FC<{ x: number; y: number; label: string }> = ({ x, y, label }) => (
  <div style={{ position: "absolute", left: x, top: y, width: 380 }}>
    <span style={{ fontSize: 11, fontWeight: 700, color: "#6E80B0", letterSpacing: 2 }}>{label}</span>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8, marginTop: 10 }}>
      {Array.from({ length: 24 }).map((_, i) => (
        <div key={i} style={{
          height: 38, borderRadius: 6,
          background: i % 3 === 0 ? "rgba(255,255,255,0.12)" : "rgba(255,255,255,0.05)",
          border: "1px solid rgba(255,255,255,0.08)",
        }} />
      ))}
    </div>
  </div>
);
