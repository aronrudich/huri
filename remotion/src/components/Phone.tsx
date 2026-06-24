import React from "react";
import { COLORS } from "../theme";

export const Phone: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => {
  return (
    <div
      style={{
        width: 440,
        height: 900,
        borderRadius: 56,
        background: "#000",
        padding: 14,
        boxShadow: "0 60px 120px rgba(0,0,0,0.5), 0 0 0 2px #1f2638 inset",
        ...style,
      }}
    >
      <div style={{
        width: "100%", height: "100%", borderRadius: 44, overflow: "hidden",
        background: COLORS.soft, position: "relative", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
          width: 120, height: 28, background: "#000", borderRadius: 999, zIndex: 10,
        }} />
        {children}
      </div>
    </div>
  );
};

export const StatusBar: React.FC = () => (
  <div style={{
    height: 50, display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "0 28px", fontSize: 14, fontWeight: 600, color: COLORS.text, paddingTop: 12,
  }}>
    <span>9:41</span>
    <span style={{ opacity: 0 }}>•</span>
    <span>●●●●</span>
  </div>
);

export const HuriLogo: React.FC<{ size?: number }> = ({ size = 28 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: size, fontWeight: 800, color: COLORS.primary, fontFamily: "Space Grotesk", letterSpacing: -0.5 }}>
    <div style={{ width: size, height: size, borderRadius: size * 0.28, background: COLORS.primary, color: "#fff", display: "grid", placeItems: "center", fontSize: size * 0.6 }}>H</div>
    huri
  </div>
);
