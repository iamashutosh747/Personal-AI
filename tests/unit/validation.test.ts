import { describe, expect, it } from "vitest";
import { capsuleInput, memoryInput, parseTags } from "@/lib/validation";

describe("parseTags", () => {
  it("normalises, de-duplicates and caps tags", () => {
    expect(parseTags("Travel, #travel,  Deep Work ,,")).toEqual(["travel", "deep-work"]);
    expect(parseTags(["A", "a", " b "])).toEqual(["a", "b"]);
    expect(parseTags(Array.from({ length: 40 }, (_, i) => `t${i}`))).toHaveLength(20);
    expect(parseTags(null)).toEqual([]);
  });
});

describe("memoryInput", () => {
  it("turns blank optional fields into null and requires a title", () => {
    const ok = memoryInput.parse({ title: " A day ", body: "", occurred_on: "", location: "", tags: [] });
    expect(ok.title).toBe("A day");
    expect(ok.occurred_on).toBeNull();
    expect(ok.location).toBeNull();
    expect(memoryInput.safeParse({ title: "   " }).success).toBe(false);
    expect(memoryInput.safeParse({ title: "x", occurred_on: "01/02/2024" }).success).toBe(false);
    expect(memoryInput.safeParse({ title: "x", kind: "nonsense" }).success).toBe(false);
  });
});

describe("capsuleInput", () => {
  it("requires a date and a title", () => {
    expect(capsuleInput.safeParse({ title: "To me", open_on: "2027-01-01" }).success).toBe(true);
    expect(capsuleInput.safeParse({ title: "To me", open_on: "" }).success).toBe(false);
    expect(capsuleInput.safeParse({ title: "", open_on: "2027-01-01" }).success).toBe(false);
  });
});
