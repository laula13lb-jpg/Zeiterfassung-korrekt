# Sicherheitskonzept (Kurzfassung)

| Bereich | Umsetzung |
|---|---|
| Transport | HTTPS über Caddy (Let's Encrypt), HSTS |
| Anmeldung Mitarbeiter | PIN 4–6 Ziffern, triviale PINs abgelehnt, Argon2id-Hash, Sperre 5 Min. nach 5 Fehlversuchen, Protokoll, Rate-Limit pro IP, PIN-Wechsel beim ersten Login |
| Anmeldung Admin | Benutzername + Passwort (≥ 12 Zeichen, 3 Zeichenklassen), optional/verpflichtend TOTP-2FA, eigene Sitzung, 30 Min. Inaktivität / max. 10 Std. |
| Sitzungen | zufälliges Token, in der DB nur SHA-256; Cookies HttpOnly, Secure, SameSite=Strict |
| CSRF | Server-Aktionen mit Origin-Prüfung (Next.js), SameSite=Strict, Exporte nur GET ohne Seiteneffekte |
| Rechte | serverseitige Prüfung in jeder Seite/Aktion/API (`requireEmployee`, `requireAdmin`, Abteilungsleiter nur eigene Abteilung, nie eigene Anträge) |
| Browser | Content-Security-Policy mit Nonce, keine externen Skripte/Schriften/CDNs, X-Frame-Options DENY, Permissions-Policy (kein GPS/Kamera/Mikrofon) |
| Terminal | Freischaltung per Einmal-Code (24 Std.), Gerätecookie, sperrbar; kurzlebiges signiertes Aktions-Token nach PIN-Prüfung |
| Offline-Terminal | Warteschlange im Tablet (IndexedDB), wird nach Übertragung sofort gelöscht; PIN-Prüfung bei der Übertragung; Tablet im Kiosk-Modus betreiben |
| Daten | Originalbuchungen nie gelöscht, Änderungsprotokoll; keine Diagnosen; automatische Anonymisierung nach Fristablauf |
| Geheimnisse | `.env` (nicht im Git), 2FA-Schlüssel AES-256-GCM-verschlüsselt mit `APP_SECRET` |
| Betrieb | Backups täglich + verschlüsselt extern, Updates mit automatischem Backup und Rückfall (Meilenstein 8) |
