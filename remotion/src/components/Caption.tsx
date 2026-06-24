import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

export const Caption: React.FC<{ text: string; delay?: number }> = ({ text, delay = 0 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const f = frame - delay;
  const s = spring({ frame: f, fps, config: { damping: 18, stiffness: 120 } });
  const y = interpolate(s, [0, 1], [40, 0]);
  const opacity = interpolate(f, [0, 12], [0, 1], { extrapolateRight: "clamp", extrapolateLeft: "clamp" });
  return (
    <div style={{
      position: "absolute", bottom: 70, left: 0, right: 0, textAlign: "center",
      padding: "0 120px", opacity, transform: `translateY(${y}px)`,
    }}>
      <p style={{
        display: "inline-block", fontSize: 38, fontWeight: 600, color: "#fff", lineHeight: 1.3,
        background: "rgba(11,18,32,0.72)", padding: "18px 32px", borderRadius: 20,
        backdropFilter: "blur(0)", maxWidth: 1400, fontFamily: "Inter",
      }}>{text}</p>
    </div>
  );
};
