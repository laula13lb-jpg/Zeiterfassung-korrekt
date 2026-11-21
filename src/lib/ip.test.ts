import { describe, expect, it } from "vitest";
import { ipInRanges, isValidRange } from "./ip";

describe("IP-Freigabe", () => {
  it("CIDR und Einzeladressen", () => {
    expect(ipInRanges("192.168.178.23", ["192.168.178.0/24"])).toBe(true);
    expect(ipInRanges("192.168.179.23", ["192.168.178.0/24"])).toBe(false);
    expect(ipInRanges("::ffff:192.168.178.5", ["192.168.178.0/24"])).toBe(true);
    expect(ipInRanges("84.10.20.30", ["84.10.20.30"])).toBe(true);
    expect(ipInRanges("2a01:db8::1", ["2a01:db8::1"])).toBe(true);
    expect(ipInRanges(null, ["0.0.0.0/0"])).toBe(false);
  });
  it("Validierung", () => {
    expect(isValidRange("10.0.0.0/8")).toBe(true);
    expect(isValidRange("10.0.0/8")).toBe(false);
    expect(isValidRange("hallo")).toBe(false);
  });
});
