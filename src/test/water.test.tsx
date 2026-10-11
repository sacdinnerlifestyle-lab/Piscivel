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

import { poolVolume } from "@/lib/mock";
describe("cálculo de volume", () => {
  it("8 x 4 x 1,4 m = 44,8 m³", () => expect(poolVolume(8, 4, 1.4)).toBe(44.8));
  it("medida faltando não calcula", () => expect(poolVolume(8, 0, 1.4)).toBeNull());
});

import { recurringDates } from "@/lib/mock";
describe("visitas recorrentes", () => {
  it("seg e qui por 4 semanas = 8 visitas no horário escolhido", () => {
    const ds = recurringDates(new Date(2026, 9, 12), [1, 4], "09:30", 4); // 12/10/2026 é segunda
    expect(ds).toHaveLength(8);
    expect(ds.every((d) => d.getDay() === 1 || d.getDay() === 4)).toBe(true);
    expect(ds[0]!.getHours()).toBe(9);
    expect(ds[0]!.getMinutes()).toBe(30);
  });
});
