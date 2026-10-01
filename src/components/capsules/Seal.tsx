/** A wax seal, drawn rather than photographed. */
export function Seal({ size = 72, broken }: { size?: number; broken?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 80 80" aria-hidden>
      <defs>
        <radialGradient id="wax" cx="40%" cy="35%" r="70%">
          <stop offset="0%" stopColor="var(--accent)" stopOpacity="1" />
          <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.55" />
        </radialGradient>
      </defs>
      <path
        d="M40 4c6 0 8 5 13 6s10-2 13 3 0 9 2 14 7 7 6 13-6 7-7 12 2 10-3 13-9 0-14 2-7 7-13 7-8-5-13-6-10 2-13-3 0-9-2-14-7-7-6-13 6-7 7-12-2-10 3-13 9 0 14-2 7-7 13-7Z"
        fill="url(#wax)"
        opacity={broken ? 0.5 : 1}
      />
      <circle cx="40" cy="40" r="20" fill="none" stroke="var(--accent-ink)" strokeOpacity=".35" strokeWidth="1.5" />
      <circle cx="40" cy="40" r="4" fill="var(--accent-ink)" fillOpacity=".55" />
      {broken && <path d="M22 30 38 42 30 52 46 58" stroke="var(--bg)" strokeWidth="2.5" fill="none" />}
    </svg>
  );
}
