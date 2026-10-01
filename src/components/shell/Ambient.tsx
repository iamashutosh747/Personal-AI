import type { World } from "@/lib/types";

/**
 * The quiet visual atmosphere behind every room. Pure CSS/SVG, no images, so
 * it costs nothing to load and stops completely when motion is turned off.
 */
export function Ambient({ world }: { world?: World | string }) {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <div
        className="glow glow-a"
        style={{ width: "62vmax", height: "62vmax", left: "-12vmax", top: "-30vmax", background: "radial-gradient(circle, var(--glow-a), transparent 65%)" }}
      />
      <div
        className="glow glow-b"
        style={{ width: "70vmax", height: "70vmax", right: "-30vmax", bottom: "-40vmax", background: "radial-gradient(circle, var(--glow-b), transparent 65%)" }}
      />
      {world === "quiet-observatory" && <Stars />}
      {world === "rainy-window" && (
        <div
          className="rain absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(97deg, transparent 0 22px, rgb(255 255 255 / 0.9) 22px 23px, transparent 23px 61px), repeating-linear-gradient(95deg, transparent 0 37px, rgb(255 255 255 / 0.6) 37px 38px, transparent 38px 89px)",
            backgroundSize: "100% 46px, 100% 71px",
            maskImage: "linear-gradient(to bottom, transparent, black 30%, black 70%, transparent)",
          }}
        />
      )}
      {world === "deep-forest" && (
        <div
          className="absolute inset-x-0 bottom-0 h-[45vh] opacity-40"
          style={{ background: "linear-gradient(to top, rgb(0 0 0 / 0.45), transparent)" }}
        />
      )}
      <div className="grain" />
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse at 50% 120%, transparent 40%, rgb(0 0 0 / 0.35))" }}
      />
    </div>
  );
}

function Stars() {
  // Deterministic positions so server and client render the same sky.
  const stars = Array.from({ length: 70 }, (_, i) => {
    const x = (i * 73.13) % 100;
    const y = (i * 37.77 + (i % 7) * 11) % 100;
    const r = i % 9 === 0 ? 1.4 : i % 3 === 0 ? 1 : 0.6;
    return { x, y, r, t: 4 + (i % 6) * 1.3, d: (i % 10) * 0.7 };
  });
  return (
    <svg className="absolute inset-0 h-full w-full" preserveAspectRatio="none">
      {stars.map((s, i) => (
        <circle
          key={i}
          className="star"
          cx={`${s.x}%`}
          cy={`${s.y}%`}
          r={s.r}
          fill="var(--ink)"
          opacity={0.5}
          style={{ ["--t" as string]: `${s.t}s`, animationDelay: `${s.d}s` }}
        />
      ))}
    </svg>
  );
}
