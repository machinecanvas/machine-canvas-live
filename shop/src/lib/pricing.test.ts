import { describe, expect, it } from "vitest";
import { areaM2, dpiVerdict, effectiveDpi, formatGBP, formatM2, newCustomerDiscount, quote, validDimensions } from "./pricing";

describe("quote", () => {
  it("charges £197 setup + £97 per m² normally", () => {
    const q = quote(100, 150); // 1.5 m²
    expect(q.areaM2).toBeCloseTo(1.5);
    expect(q.standard.setupPence).toBe(19700);
    expect(q.standard.areaPence).toBe(14550);
    expect(q.standard.pricePence).toBe(34250);
  });

  it("charges £150 setup + £50 per m² on a first booking", () => {
    const q = quote(100, 150);
    expect(q.newCustomer?.pricePence).toBe(22500);
    expect(newCustomerDiscount(q)).toBe(34250 - 22500);
    expect(quote(100, 100).newCustomer?.pricePence).toBe(20000); // 1 m²
  });

  it("prices to the exact penny", () => {
    // 1.23 m × 4.56 m = 5.6088 m² → 197 + 5.6088 × 97 = £741.05
    expect(quote(123, 456).standard.pricePence).toBe(74105);
    // new customer: 150 + 5.6088 × 50 = £430.44
    expect(quote(123, 456).newCustomer?.pricePence).toBe(43044);
  });

  it("flags jobs over the per-slot area limit", () => {
    expect(quote(500, 300).overMaxArea).toBe(false); // exactly 15 m²
    expect(quote(500, 301).overMaxArea).toBe(true);
  });
});

describe("helpers", () => {
  it("computes area in m²", () => {
    expect(areaM2(250, 200)).toBeCloseTo(5);
    expect(formatM2(1.5)).toBe("1.5 m²");
    expect(formatM2(5.60881)).toBe("5.61 m²");
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
