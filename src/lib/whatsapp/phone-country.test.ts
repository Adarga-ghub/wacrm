import { describe, expect, it } from "vitest";
import { getPhoneCountry } from "./phone-country";

describe("getPhoneCountry", () => {
  it.each([
    ["573112021423", "CO", "Colombia"],
    ["+52 1 55 1234 5678", "MX", "México"],
    ["5491123456789", "AR", "Argentina"],
    ["593991234567", "EC", "Ecuador"],
    ["18095551234", "DO", "República Dominicana"],
    ["17875551234", "PR", "Puerto Rico"],
    ["14165551234", "CA", "Canadá"],
    ["14155551212", "US", "Estados Unidos"],
    ["34612345678", "ES", "España"],
    ["50212345678", "GT", "Guatemala"],
    ["77011234567", "KZ", "Kazajistán"],
    ["79161234567", "RU", "Rusia"],
  ])("%s → %s", (phone, iso, name) => {
    const c = getPhoneCountry(phone);
    expect(c?.iso).toBe(iso);
    expect(c?.name).toBe(name);
  });

  it("returns null for empty or short numbers", () => {
    expect(getPhoneCountry("")).toBeNull();
    expect(getPhoneCountry(null)).toBeNull();
    expect(getPhoneCountry("12345")).toBeNull();
  });
});
