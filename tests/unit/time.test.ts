import { describe, expect, it } from "vitest";
import { greetingFor, hourIn, localMidnightUtc, todayIn, worldForHour } from "@/lib/time";

describe("time helpers", () => {
  it("greets by the hour", () => {
    expect(greetingFor(3)).toBe("Still awake");
    expect(greetingFor(9)).toBe("Good morning");
    expect(greetingFor(14)).toBe("Good afternoon");
    expect(greetingFor(19)).toBe("Good evening");
    expect(greetingFor(23)).toBe("Late night");
  });

  it("reads the hour and date in the person's own time zone", () => {
    const t = new Date("2026-10-01T23:30:00Z");
    expect(hourIn("Asia/Kolkata", t)).toBe(5);
    expect(todayIn("Asia/Kolkata", t)).toBe("2026-10-02");
    expect(todayIn("America/Los_Angeles", t)).toBe("2026-10-01");
    expect(hourIn("Not/AZone", t)).toBe(23);
  });

  it("lets the light follow the clock but keeps the chosen world by day", () => {
    expect(worldForHour(2, "deep-forest")).toBe("quiet-observatory");
    expect(worldForHour(6, "deep-forest")).toBe("golden-hour");
    expect(worldForHour(12, "deep-forest")).toBe("deep-forest");
    expect(worldForHour(22, "deep-forest")).toBe("midnight-library");
  });

  it("opens capsules at local midnight", () => {
    // India is UTC+5:30, so getTimezoneOffset() is -330.
    expect(localMidnightUtc("2027-01-01", -330).toISOString()).toBe("2026-12-31T18:30:00.000Z");
    expect(localMidnightUtc("2027-01-01", 480).toISOString()).toBe("2027-01-01T08:00:00.000Z");
  });
});
