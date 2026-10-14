import { describe, it, expect } from "vitest";
import { nextDueDate } from "@/lib/mock";
describe("nextDueDate", () => {
  it("same month when day not passed", () => expect(nextDueDate(20, new Date(2026, 9, 14)).getDate()).toBe(20));
  it("next month when passed", () => expect(nextDueDate(10, new Date(2026, 9, 14)).getMonth()).toBe(10));
  it("clamps to last day", () => expect(nextDueDate(31, new Date(2026, 1, 1)).getDate()).toBe(28));
});
