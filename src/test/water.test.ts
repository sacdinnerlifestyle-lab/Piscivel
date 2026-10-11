import { describe, it, expect } from "vitest";
import { inRange } from "@/lib/mock";

describe("faixas ideais da água", () => {
  it("pH equilibrado entre 7.2 e 7.6", () => {
    expect(inRange("ph", 7.4)).toBe(true);
    expect(inRange("ph", 7.8)).toBe(false);
  });
  it("cloro livre entre 1 e 3 ppm", () => {
    expect(inRange("free_chlorine", 0.5)).toBe(false);
    expect(inRange("free_chlorine", 2)).toBe(true);
  });
  it("valor ausente não é avaliado", () => {
    expect(inRange("alkalinity", null)).toBeNull();
  });
});
