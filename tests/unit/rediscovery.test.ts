import { describe, expect, it } from "vitest";
import { describeAgo, pickMoment, type MomentCandidate } from "@/lib/rediscovery";

const KINDS = ["reflection", "event", "goal", "idea", "photo", "conversation", "place"];

function mem(id: string, date: string, extra: Partial<MomentCandidate> = {}): MomentCandidate {
  return { id, kind: "reflection", title: id, body: "", occurred_on: date, created_at: `${date}T10:00:00Z`, source_type: "manual", has_photo: false, ...extra };
}

describe("pickMoment", () => {
  it("returns nothing when rediscovery is off", () => {
    expect(pickMoment([mem("a", "2024-01-01")], "2026-10-01", "off", KINDS)).toBeNull();
  });

  it("never surfaces memories younger than 30 days", () => {
    expect(pickMoment([mem("a", "2026-09-20")], "2026-10-01", "daily", KINDS)).toBeNull();
  });

  it("prefers an anniversary and names how long ago it was", () => {
    const m = pickMoment([mem("old", "2023-02-02"), mem("anniv", "2025-10-01")], "2026-10-01", "daily", KINDS);
    expect(m?.memory.id).toBe("anniv");
    expect(m?.reason).toBe("One year ago today");
    const m2 = pickMoment([mem("anniv", "2023-10-01")], "2026-10-01", "daily", KINDS);
    expect(m2?.reason).toBe("3 years ago today");
  });

  it("respects the chosen kinds", () => {
    const pool = [mem("goal", "2024-01-01", { kind: "goal" })];
    expect(pickMoment(pool, "2026-10-01", "daily", ["reflection"])).toBeNull();
    expect(pickMoment(pool, "2026-10-01", "daily", ["goal"])?.memory.id).toBe("goal");
  });

  it("matches kept conversations and photos by their source", () => {
    const convo = mem("c", "2024-01-01", { kind: "idea", source_type: "conversation" });
    expect(pickMoment([convo], "2026-10-01", "daily", ["conversation"])?.memory.id).toBe("c");
    const photo = mem("p", "2024-01-01", { kind: "event", has_photo: true });
    expect(pickMoment([photo], "2026-10-01", "daily", ["photo"])?.reason).toMatch(/^A photograph from/);
  });

  it("is stable within a day, and within a week for weekly", () => {
    const pool = Array.from({ length: 40 }, (_, i) => mem(`m${i}`, `2024-0${(i % 9) + 1}-1${i % 9}`));
    const a = pickMoment(pool, "2026-10-01", "daily", KINDS)?.memory.id;
    expect(pickMoment(pool, "2026-10-01", "daily", KINDS)?.memory.id).toBe(a);
    // 2026-09-28 is a Monday; the whole week shares one pick.
    const week = ["2026-09-28", "2026-09-30", "2026-10-04"].map((d) => pickMoment(pool, d, "weekly", KINDS)?.memory.id);
    expect(new Set(week).size).toBe(1);
  });
});

describe("describeAgo", () => {
  it("speaks in human units", () => {
    expect(describeAgo(31)).toBe("a month ago");
    expect(describeAgo(100)).toBe("3 months ago");
    expect(describeAgo(380)).toBe("a year ago");
    expect(describeAgo(1100)).toBe("3 years ago");
  });
});
