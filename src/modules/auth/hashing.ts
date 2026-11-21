import { hash, verify } from "@node-rs/argon2";

// Argon2id mit OWASP-empfohlenen Parametern
const OPTS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;

export function hashSecret(secret: string): Promise<string> {
  return hash(secret, OPTS);
}

export async function verifySecret(hashed: string | null | undefined, secret: string): Promise<boolean> {
  if (!hashed) {
    // gleiche Rechenzeit wie bei echtem Vergleich (kein Timing-Hinweis auf unbekannte Konten)
    await hash(secret, OPTS);
    return false;
  }
  try {
    return await verify(hashed, secret);
  } catch {
    return false;
  }
}
