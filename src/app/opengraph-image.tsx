import { ImageResponse } from "next/og";

export const alt = "Conta comigo — finanças sem ansiedade";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        alignItems: "center",
        background: "linear-gradient(135deg, #effaff 0%, #ffffff 48%, #ecfdf5 100%)",
        color: "#0f172a",
        display: "flex",
        height: "100%",
        justifyContent: "center",
        padding: "72px",
        width: "100%",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", maxWidth: 950 }}>
        <div style={{ alignItems: "center", display: "flex", gap: 22 }}>
          <div
            style={{
              alignItems: "center",
              background: "#0284c7",
              borderRadius: 28,
              color: "white",
              display: "flex",
              fontSize: 62,
              fontWeight: 800,
              height: 112,
              justifyContent: "center",
              width: 112,
            }}
          >
            C
          </div>
          <span style={{ fontSize: 68, fontWeight: 800, letterSpacing: -3 }}>Conta comigo</span>
        </div>
        <div style={{ fontSize: 46, fontWeight: 650, lineHeight: 1.15, marginTop: 42 }}>
          Planejamento financeiro pessoal e familiar
        </div>
        <div style={{ color: "#475569", fontSize: 28, marginTop: 24 }}>
          Decisões mais claras, sem julgamento e sem promessas fáceis.
        </div>
      </div>
    </div>,
    size,
  );
}
