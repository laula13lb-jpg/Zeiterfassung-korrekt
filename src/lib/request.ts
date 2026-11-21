import { headers } from "next/headers";

/** Client-IP: hinter dem Reverse-Proxy (Caddy) aus X-Forwarded-For, erster Eintrag */
export async function clientIp(): Promise<string | null> {
  const h = await headers();
  const xff = h.get("x-forwarded-for");
  if (xff) return xff.split(",")[0]!.trim();
  return h.get("x-real-ip");
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 300) ?? null;
}
