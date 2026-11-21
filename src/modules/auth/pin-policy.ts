/**
 * PIN-Regeln: 4–6 Ziffern, keine trivialen Muster.
 * Gibt eine deutsche Fehlermeldung zurück oder null, wenn die PIN zulässig ist.
 */
export function validatePin(pin: string, opts: { personnelNo?: string } = {}): string | null {
  if (!/^\d{4,6}$/.test(pin)) return "Die PIN muss aus 4 bis 6 Ziffern bestehen.";

  const digits = pin.split("").map(Number);

  // alle Ziffern gleich: 0000, 111111
  if (digits.every((d) => d === digits[0])) return "Die PIN darf nicht aus lauter gleichen Ziffern bestehen.";

  // auf- oder absteigende Folge: 1234, 4321, 3456, 987654 (auch mit Überlauf 8901/0987)
  const asc = digits.every((d, i) => i === 0 || d === (digits[i - 1]! + 1) % 10);
  const desc = digits.every((d, i) => i === 0 || d === (digits[i - 1]! + 9) % 10);
  if (asc || desc) return "Die PIN darf keine Zahlenfolge wie 1234 sein.";

  // sich wiederholende Blöcke: 1212, 123123, 121212, 4545
  for (const len of [1, 2, 3]) {
    if (pin.length % len === 0 && pin.length > len) {
      const block = pin.slice(0, len);
      if (block.repeat(pin.length / len) === pin) return "Die PIN darf kein sich wiederholendes Muster sein.";
    }
  }

  // Jahreszahlen 19xx / 20xx (Geburtsjahr-artig)
  if (pin.length === 4 && /^(19|20)\d\d$/.test(pin)) return "Die PIN darf keine Jahreszahl sein.";

  // Datumsartige 6-stellige PIN mit Jahr am Ende/Anfang (TTMMJJ / JJMMTT) – Geburtsdatum
  if (pin.length === 6 && (looksLikeDate(pin.slice(0, 2), pin.slice(2, 4)) || looksLikeDate(pin.slice(4, 6), pin.slice(2, 4)))) {
    return "Die PIN darf kein Datum (z. B. Geburtsdatum) sein.";
  }

  // weitere sehr häufige PINs
  const common = new Set(["1004", "2580", "0852", "1122", "1313", "6969", "5683", "1342", "0007", "007007", "112233", "654321", "159753", "147258", "258456", "102030"]);
  if (common.has(pin)) return "Diese PIN ist zu leicht zu erraten.";

  if (opts.personnelNo && pin === opts.personnelNo.replace(/\D/g, "")) {
    return "Die PIN darf nicht der Personalnummer entsprechen.";
  }
  return null;
}

function looksLikeDate(dd: string, mm: string): boolean {
  const d = Number(dd);
  const m = Number(mm);
  return d >= 1 && d <= 31 && m >= 1 && m <= 12;
}

/** Passwortregeln für Admins */
export function validatePassword(pw: string, opts: { loginName?: string } = {}): string | null {
  if (pw.length < 12) return "Das Passwort muss mindestens 12 Zeichen lang sein.";
  if (pw.length > 200) return "Das Passwort ist zu lang.";
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes < 3) return "Das Passwort braucht mindestens drei von: Kleinbuchstaben, Großbuchstaben, Ziffern, Sonderzeichen.";
  if (opts.loginName && pw.toLowerCase().includes(opts.loginName.toLowerCase())) {
    return "Das Passwort darf den Benutzernamen nicht enthalten.";
  }
  if (/^(.)\1+$/.test(pw) || /passwort|password|bludau|autoklinik/i.test(pw)) {
    return "Das Passwort ist zu leicht zu erraten.";
  }
  return null;
}
