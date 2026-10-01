import { ImageResponse } from "next/og";

/** The mark as a PNG: a lit point in a quiet circle, on ink. */
export function markImage(size: number, padding = 0.18) {
  const inner = size * (1 - padding * 2);
  return new ImageResponse(
    (
      <div style={{ width: size, height: size, background: "#0d0f14", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            width: inner,
            height: inner,
            borderRadius: "50%",
            border: `${Math.max(2, size / 90)}px solid rgba(236,230,218,0.3)`,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "radial-gradient(circle, rgba(217,163,91,0.25) 0%, rgba(13,15,20,0) 60%)",
          }}
        >
          <div style={{ width: inner * 0.2, height: inner * 0.2, borderRadius: "50%", background: "#d9a35b", boxShadow: "0 0 40px #d9a35b" }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
