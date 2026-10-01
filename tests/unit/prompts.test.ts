import { describe, expect, it } from "vitest";
import { DAILY_PROMPTS, promptForDate } from "@/lib/prompts";

describe("promptForDate", () => {
  it("is the same all day and comes from the hand-written list", () => {
    expect(promptForDate("2026-10-01")).toBe(promptForDate("2026-10-01"));
    expect(DAILY_PROMPTS).toContain(promptForDate("2026-10-01"));
  });

  it("changes from one day to the next", () => {
    const days = Array.from({ length: 30 }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));
    const prompts = days.map(promptForDate);
    for (let i = 1; i < prompts.length; i++) expect(prompts[i]).not.toBe(prompts[i - 1]);
    expect(new Set(prompts).size).toBe(30);
  });
});
