import { NextResponse, type NextRequest } from "next/server";

/**
 * Sicherheits-Header für alle Seiten. Strikte Content-Security-Policy mit Nonce:
 * keine externen Skripte, Schriften, CDNs oder Tracker.
 * (Rechteprüfungen passieren serverseitig in den Seiten/Aktionen, nicht hier.)
 */
export function middleware(req: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const dev = process.env.NODE_ENV !== "production";
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${dev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${dev ? " ws:" : ""}`,
    "manifest-src 'self'",
    "worker-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  res.headers.set("X-Content-Type-Options", "nosniff");
  res.headers.set("Referrer-Policy", "same-origin");
  res.headers.set("X-Frame-Options", "DENY");
  res.headers.set("Permissions-Policy", "geolocation=(), camera=(), microphone=(), payment=()");
  res.headers.set("Cross-Origin-Opener-Policy", "same-origin");
  // HSTS nur bei HTTPS-Betrieb (hinter Caddy)
  if (req.headers.get("x-forwarded-proto") === "https") res.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|icons/|sw.js|offline.html|logo.jpg|manifest.webmanifest).*)" }],
};
