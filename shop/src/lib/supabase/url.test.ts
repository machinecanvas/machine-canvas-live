import { describe, expect, it } from "vitest";
import { supabaseProjectUrl } from "./url";

describe("supabaseProjectUrl", () => {
  it("accepts the plain project URL or the REST endpoint", () => {
    for (const raw of ["https://abc.supabase.co", "https://abc.supabase.co/", "https://abc.supabase.co/rest/v1", "https://abc.supabase.co/rest/v1/", " https://abc.supabase.co/rest/v1/ "]) {
      expect(supabaseProjectUrl(raw)).toBe("https://abc.supabase.co");
    }
  });
});
