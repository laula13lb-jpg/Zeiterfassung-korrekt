import { describe, expect, it } from "vitest";
import { validatePassword, validatePin } from "./pin-policy";

describe("validatePin", () => {
  it.each(["1234", "4321", "0000", "111111", "123456", "654321", "8901", "1212", "123123", "1987", "2001", "150385", "1004"])(
    "lehnt triviale PIN %s ab",
    (pin) => expect(validatePin(pin)).not.toBeNull(),
  );
  it.each(["12", "1234567", "12a4", ""])("lehnt ungültiges Format %s ab", (pin) => expect(validatePin(pin)).not.toBeNull());
  it.each(["4719", "8352", "60417", "739148", "2716"])("akzeptiert PIN %s", (pin) => expect(validatePin(pin)).toBeNull());
  it("lehnt Personalnummer als PIN ab", () => {
    expect(validatePin("4711", { personnelNo: "4711" })).not.toBeNull();
  });
});

describe("validatePassword", () => {
  it("verlangt Länge und Zeichenvielfalt", () => {
    expect(validatePassword("kurz")).not.toBeNull();
    expect(validatePassword("nurkleinbuchstabenlang")).not.toBeNull();
    expect(validatePassword("Werkstatt-Lack-2026!")).toBeNull();
  });
  it("lehnt Benutzername im Passwort ab", () => {
    expect(validatePassword("Verwaltung-buero1!", { loginName: "buero" })).not.toBeNull();
  });
});
