import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { COLORS } from "../../themeV2";
import { Phone, StatusBar, HuriLogo } from "../../components/Phone";

/**
 * Cycles through 3 forms: Advisor pickup, Technician pickup, Park.
 * Top-right buttons (Park / Pickup) always highlighted.
 */
export const Buttons: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 18 } });

  // Form rotation: 0-150 Advisor, 150-300 Technician, 300-474 Park
  let active: "advisor" | "tech" | "park" = "advisor";
  if (frame >= 150 && frame < 300) active = "tech";
  else if (frame >= 300) active = "park";

  // Highlight pulse
  const pickupHighlight = active !== "park";
  const parkHighlight = active === "park";

  return (
    <AbsoluteFill style={{
      background: `linear-gradient(135deg, ${COLORS.surface} 0%, #1a2548 100%)`,
      display: "flex", alignItems: "center", justifyContent: "center", gap: 80,
    }}>
      <div style={{ flex: 1, maxWidth: 620, paddingLeft: 100, opacity: enter }}>
        <p style={{ fontSize: 50, fontWeight: 800, color: "#fff", fontFamily: "Space Grotesk", margin: 0, lineHeight: 1.05 }}>
          Park. Pickup.<br />Always one tap away.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 18, marginTop: 32 }}>
          <Row icon="🧾" title="Advisor" desc="Pickup → customer car" active={active === "advisor"} />
          <Row icon="🔧" title="Technician" desc="Pickup → into their bay" active={active === "tech"} />
          <Row icon="📍" title="Anyone" desc="Park → RO + Spot number" active={active === "park"} />
        </div>
      </div>

      <div style={{ opacity: enter, transform: `translateX(${interpolate(enter, [0, 1], [60, 0])}px)` }}>
        <Phone>
          <StatusBar />
          <div style={{ padding: "10px 22px 8px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <HuriLogo />
            <div style={{ display: "flex", gap: 8 }}>
              <TopBtn label="Park" active={parkHighlight} />
              <TopBtn label="Pickup" active={pickupHighlight} />
            </div>
          </div>

          {active === "advisor" && <FormPanel title="New pickup" subtitle="for customer" fields={[["RO #", "284715"], ["Advisor", "Mike R."], ["Model", "Jeep Wrangler"]]} />}
          {active === "tech" && <FormPanel title="New pickup" subtitle="to my bay" fields={[["RO #", "284702"], ["Technician", "Carlos M."], ["Bay", "Bay 4"]]} />}
          {active === "park" && <FormPanel title="Park a car" subtitle="log the spot" fields={[["RO # *", "284698"], ["Spot # *", "12"], ["Model", "Dodge Charger"]]} />}
        </Phone>
      </div>
    </AbsoluteFill>
  );
};

const TopBtn: React.FC<{ label: string; active: boolean }> = ({ active, label }) => (
  <div style={{
    padding: "8px 16px", borderRadius: 999,
    background: COLORS.primary, color: "#fff", fontSize: 14, fontWeight: 700,
    boxShadow: active ? `0 0 0 4px rgba(47,107,255,0.4), 0 6px 16px rgba(47,107,255,0.5)` : "none",
    transform: active ? "scale(1.06)" : "scale(1)",
  }}>{label}</div>
);

const FormPanel: React.FC<{ title: string; subtitle: string; fields: [string, string][] }> = ({ title, subtitle, fields }) => (
  <>
    <div style={{ padding: "8px 22px 14px" }}>
      <p style={{ margin: 0, fontSize: 24, fontWeight: 800, fontFamily: "Space Grotesk", color: COLORS.text }}>{title}</p>
      <p style={{ margin: "2px 0 0", fontSize: 14, color: COLORS.mute }}>{subtitle}</p>
    </div>
    <div style={{ background: "#fff", flex: 1, padding: "8px 22px 22px", display: "flex", flexDirection: "column", gap: 14 }}>
      {fields.map(([label, value], i) => (
        <div key={i}>
          <p style={{ margin: "0 0 5px", fontSize: 12, fontWeight: 700, color: COLORS.mute, textTransform: "uppercase", letterSpacing: 1 }}>{label}</p>
          <div style={{ background: "#F1F4FB", borderRadius: 12, padding: "14px 16px", fontSize: 20, fontWeight: 700, color: COLORS.text }}>{value}</div>
        </div>
      ))}
      <div style={{ flex: 1 }} />
      <button style={{
        background: COLORS.primary, color: "#fff", border: "none", borderRadius: 14,
        padding: "16px 0", fontSize: 18, fontWeight: 700, marginBottom: 8,
      }}>Save</button>
    </div>
  </>
);

const Row: React.FC<{ icon: string; title: string; desc: string; active: boolean }> = ({ icon, title, desc, active }) => (
  <div style={{
    display: "flex", gap: 18, alignItems: "center",
    padding: "16px 22px", borderRadius: 16,
    background: active ? "rgba(47,107,255,0.18)" : "rgba(255,255,255,0.04)",
    border: `2px solid ${active ? COLORS.primary : "transparent"}`,
    transform: active ? "scale(1.02)" : "scale(1)",
  }}>
    <div style={{ fontSize: 36 }}>{icon}</div>
    <div>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 700, color: "#fff", fontFamily: "Space Grotesk" }}>{title}</p>
      <p style={{ margin: "2px 0 0", fontSize: 18, color: "#9BB0E0" }}>{desc}</p>
    </div>
  </div>
);
