import { describe, it, expect } from "vitest";
import { localDateKey, visitTimestamp } from "@/lib/visit-datetime";

describe("technician visit date and time", () => {
  it("saves the date chosen by the technician together with the chosen time", () => {
    const saved = new Date(visitTimestamp("2026-10-19", "14:35"));
    expect(localDateKey(saved)).toBe("2026-10-19");
    expect(saved.getHours()).toBe(14);
    expect(saved.getMinutes()).toBe(35);
  });
  it("rejects a missing date or time", () => {
    expect(() => visitTimestamp("", "14:35")).toThrow();
    expect(() => visitTimestamp("2026-10-19", "")).toThrow();
  });
  it("rejects invalid calendar dates", () => {
    expect(() => visitTimestamp("2026-02-30", "14:35")).toThrow();
  });
});