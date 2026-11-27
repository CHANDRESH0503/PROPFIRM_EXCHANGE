import { ImageResponse } from "next/og";
import { brand } from "@/config/brand";

/** Default social preview for every page without its own image. */
export const alt = `${brand.name}: ${brand.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: 80,
        background: "#0b0d10",
        color: "#f2f0eb",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ fontSize: 44, fontWeight: 700 }}>{brand.name}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ fontSize: 72, fontWeight: 700, lineHeight: 1.05 }}>{brand.tagline}</div>
        <div style={{ fontSize: 30, color: "#9aa3af" }}>
          Prop-firm deals, Coins back on purchases, free trader tools and a journal.
        </div>
      </div>
      <div style={{ fontSize: 22, color: "#9aa3af" }}>
        Challenges are simulated evaluations. Most traders do not pass. We earn a commission.
      </div>
    </div>,
    size,
  );
}
