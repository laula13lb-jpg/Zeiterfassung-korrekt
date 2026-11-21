/**
 * Prüft, ob eine IP in einer Liste von Bereichen liegt.
 * Unterstützt IPv4 mit CIDR ("192.168.1.0/24"), einzelne IPv4/IPv6-Adressen
 * und IPv4-gemappte IPv6-Adressen ("::ffff:192.168.1.5").
 */
export function ipInRanges(ip: string | null | undefined, ranges: string[]): boolean {
  if (!ip) return false;
  const clean = ip.trim().replace(/^::ffff:/i, "");
  return ranges.some((r) => matches(clean, r.trim()));
}

function matches(ip: string, range: string): boolean {
  if (!range) return false;
  if (!range.includes("/")) return ip.toLowerCase() === range.toLowerCase();
  const [base, bitsStr] = range.split("/");
  const bits = Number(bitsStr);
  const a = v4(ip);
  const b = v4(base!);
  if (a === null || b === null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((a & mask) >>> 0) === ((b & mask) >>> 0);
}

function v4(s: string): number | null {
  const p = s.split(".");
  if (p.length !== 4) return null;
  let n = 0;
  for (const x of p) {
    if (!/^\d{1,3}$/.test(x) || Number(x) > 255) return null;
    n = n * 256 + Number(x);
  }
  return n >>> 0;
}

export function isValidRange(r: string): boolean {
  const s = r.trim();
  if (s.includes("/")) {
    const [b, bits] = s.split("/");
    return v4(b!) !== null && /^\d{1,2}$/.test(bits!) && Number(bits) <= 32;
  }
  return v4(s) !== null || /^[0-9a-f:]+$/i.test(s);
}
