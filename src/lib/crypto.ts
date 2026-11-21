import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from "node:crypto";

/** Zufälliges Token (URL-sicher), z. B. für Session-Cookies */
export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function appKey(): Buffer {
  const secret = process.env.APP_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("APP_SECRET fehlt oder ist kürzer als 32 Zeichen");
  }
  return scryptSync(secret, "bludau-zeiterfassung/v1", 32);
}

/** AES-256-GCM-Verschlüsselung für Geheimnisse in der DB (z. B. TOTP-Schlüssel) */
export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", appKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ["v1", iv.toString("base64url"), tag.toString("base64url"), enc.toString("base64url")].join(".");
}

export function decrypt(payload: string): string {
  const [v, iv, tag, enc] = payload.split(".");
  if (v !== "v1" || !iv || !tag || !enc) throw new Error("Ungültiges Chiffrat");
  const decipher = createDecipheriv("aes-256-gcm", appKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(enc, "base64url")), decipher.final()]).toString("utf8");
}
