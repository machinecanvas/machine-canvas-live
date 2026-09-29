import { describe, expect, it } from "vitest";
import { areaM2, customPrice, dpiVerdict, effectiveDpi, formatGBP, newCustomerDiscount, validDimensions } from "./pricing";

describe("customPrice", () => {
  it("charges the £197 minimum for anything up to 1 m²", () => {
    expect(customPrice("wall", 100, 100).pricePence).toBe(19700);
    expect(customPrice("wall", 50, 50).pricePence).toBe(19700);
  });

  it("adds £49 per m² beyond the first", () => {
    const p = customPrice("wall", 500, 200); // 10 m²
    expect(p.areaM2).toBeCloseTo(10);
    expect(p.extraM2).toBeCloseTo(9);
    expect(p.extraCharge).toBeCloseTo(441);
    expect(p.pricePence).toBe(63800);
  });

  it("prices floors the same as walls", () => {
    expect(customPrice("floor", 400, 250).pricePence).toBe(customPrice("wall", 400, 250).pricePence);
  });

  it("rounds to the nearest whole pound", () => {
    // 1.23 m x 4.56 m = 5.6088 m² -> 197 + 4.6088 x 49 = £422.83 -> £423
    expect(customPrice("wall", 123, 456).pricePence).toBe(42300);
    for (const [w, h] of [[123, 456], [333, 77], [250, 250]]) {
      expect(customPrice("wall", w, h).pricePence % 100).toBe(0);
    }
  });

  it("flags jobs over the per-slot area limit", () => {
    expect(customPrice("wall", 500, 300).overMaxArea).toBe(false); // exactly 15 m²
    expect(customPrice("wall", 500, 301).overMaxArea).toBe(true);
  });
});

describe("newCustomerDiscount", () => {
  it("takes 50% off", () => {
    expect(newCustomerDiscount(19700)).toBe(9850);
    expect(newCustomerDiscount(63800)).toBe(31900);
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
