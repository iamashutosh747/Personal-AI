/** The Inner World mark: a lit point inside a quiet circle. */
export function Mark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden>
      <circle cx="16" cy="16" r="15" stroke="var(--ink)" strokeOpacity=".28" />
      <circle cx="16" cy="16" r="9.5" stroke="var(--ink)" strokeOpacity=".14" />
      <circle cx="16" cy="16" r="3.2" fill="var(--accent)" />
      <circle cx="16" cy="16" r="7" fill="var(--accent)" fillOpacity=".12" />
    </svg>
  );
}
