// "A Moment From Then": resurfacing your own past, chosen by simple, visible
// rules (anniversaries first, then old goals, then a seeded random pick).
// Nothing here is inferred or generated.

export interface MomentCandidate {
  id: string;
  kind: string;
  title: string;
  body: string;
  occurred_on: string | null;
  created_at: string;
  source_type: string;
  has_photo: boolean;
}

export interface Moment<T extends MomentCandidate = MomentCandidate> {
  memory: T;
  reason: string;
}

function daysBetween(a: string, b: string) {
  return Math.round((Date.parse(`${b.slice(0, 10)}T00:00:00Z`) - Date.parse(`${a.slice(0, 10)}T00:00:00Z`)) / 86400000);
}

function seeded(seed: number) {
  let t = seed + 0x6d2b79f5;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

function matchesKinds(m: MomentCandidate, kinds: string[]) {
  if (kinds.includes(m.kind)) return true;
  if (kinds.includes("conversation") && m.source_type === "conversation") return true;
  if (kinds.includes("photo") && m.has_photo) return true;
  return false;
}

export function pickMoment<T extends MomentCandidate>(
  memories: T[],
  today: string,
  frequency: "daily" | "weekly" | "off",
  kinds: string[],
): Moment<T> | null {
  if (frequency === "off") return null;
  const dayNumber = Math.floor(Date.parse(`${today}T00:00:00Z`) / 86400000);
  const seed = frequency === "weekly" ? Math.floor((dayNumber + 3) / 7) : dayNumber;

  const pool = memories.filter((m) => matchesKinds(m, kinds) && daysBetween(m.occurred_on ?? m.created_at, today) >= 30);
  if (pool.length === 0) return null;

  // 1. Anniversaries: same month and day in an earlier year.
  const mmdd = today.slice(5, 10);
  const anniversary = pool.find((m) => (m.occurred_on ?? m.created_at).slice(5, 10) === mmdd);
  if (anniversary) {
    const years = Number(today.slice(0, 4)) - Number((anniversary.occurred_on ?? anniversary.created_at).slice(0, 4));
    if (years >= 1) return { memory: anniversary, reason: years === 1 ? "One year ago today" : `${years} years ago today` };
  }

  // 2. On some days, an ambition from a while back.
  const r = seeded(seed);
  const oldGoals = pool.filter((m) => m.kind === "goal" && daysBetween(m.occurred_on ?? m.created_at, today) >= 90);
  if (oldGoals.length && r < 0.3) {
    const g = oldGoals[Math.floor(seeded(seed + 1) * oldGoals.length)]!;
    return { memory: g, reason: `An ambition from ${describeAgo(daysBetween(g.occurred_on ?? g.created_at, today))}` };
  }

  // 3. Otherwise, a seeded random moment.
  const pick = pool[Math.floor(seeded(seed + 2) * pool.length)]!;
  const label =
    pick.has_photo ? "A photograph" : pick.source_type === "conversation" ? "A conversation you kept" : pick.kind === "idea" ? "A realization" : "A moment";
  return { memory: pick, reason: `${label} from ${describeAgo(daysBetween(pick.occurred_on ?? pick.created_at, today))}` };
}

export function describeAgo(days: number): string {
  if (days < 45) return "a month ago";
  if (days < 335) return `${Math.round(days / 30)} months ago`;
  const years = Math.round(days / 365);
  return years <= 1 ? "a year ago" : `${years} years ago`;
}
