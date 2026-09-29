import { describe, expect, it } from "vitest";
import { areaM2, customPrice, dpiVerdict, effectiveDpi, formatGBP, validDimensions } from "./pricing";

describe("customPrice", () => {
  it("prices a 10 m² wall at roughly £427-£429 inc. VAT", () => {
    const p = customPrice("wall", 500, 200);
    expect(p.areaM2).toBeCloseTo(10);
    expect(p.material).toBeCloseTo(80);
    expect(p.labour).toBeCloseTo(114);
    expect(p.cost).toBeCloseTo(209);
    // 209 / 0.585 + 0.20 = 357.46 ex VAT -> 428.96 inc VAT -> £429
    expect(p.exVat).toBeCloseTo(357.46, 2);
    expect(p.pricePence).toBe(42900);
  });

  it("applies the wall minimum order for small jobs", () => {
    const p = customPrice("wall", 100, 100);
    expect(p.net).toBeLessThan(120);
    expect(p.exVat).toBe(120);
    expect(p.pricePence).toBe(14400);
  });

  it("applies the floor minimum order for small jobs", () => {
    expect(customPrice("floor", 100, 100).pricePence).toBe(18000);
  });

  it("prices floors higher than walls for the same area", () => {
    expect(customPrice("floor", 400, 250).pricePence).toBeGreaterThan(
      customPrice("wall", 400, 250).pricePence,
    );
  });

  it("always returns whole pounds", () => {
    for (const [w, h] of [[123, 456], [333, 77], [250, 250]]) {
      expect(customPrice("wall", w, h).pricePence % 100).toBe(0);
    }
  });

  it("flags jobs over the per-slot area limit", () => {
    expect(customPrice("wall", 500, 300).overMaxArea).toBe(false); // exactly 15 m²
    expect(customPrice("wall", 500, 301).overMaxArea).toBe(true);
  });
});

describe("helpers", () => {
  it("computes area in m²", () => {
    expect(areaM2(250, 200)).toBeCloseTo(5);
  });

  it("validates dimensions", () => {
    expect(validDimensions(100, 100)).toBe(true);
    expect(validDimensions(5, 100)).toBe(false);
    expect(validDimensions(Number.NaN, 100)).toBe(false);
  });

  it("computes effective DPI from the limiting side", () => {
    // 3000 px across 254 cm = 100 in -> 30 dpi; 6000 px across 127 cm = 50 in -> 120 dpi
    expect(effectiveDpi(3000, 6000, 254, 127)).toBeCloseTo(30);
    expect(dpiVerdict(30)).toBe("block");
    expect(dpiVerdict(75)).toBe("warn");
    expect(dpiVerdict(150)).toBe("ok");
  });

  it("formats GBP", () => {
    expect(formatGBP(42900)).toBe("£429");
    expect(formatGBP(42950)).toBe("£429.50");
  });
});
