# Zeiterfassung – Autoklinik Bludau

Web-App (PWA) für Arbeitszeiterfassung, Urlaub und Krankmeldungen der
Autoklinik Bludau (Bludau GmbH, Braunschweig).

**Stand:** Meilenstein 5 – Krankmeldungen (datensparsam), Rückbuchung von Urlaub bei Krankheit, Hinweise 6 Wochen/BEM, Abwesenheitsübersicht.

| Bereich | Technik |
|---|---|
| Oberfläche & Server | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Datenbank | PostgreSQL 16, Prisma 6 |
| Sicherheit | Argon2id (PIN/Passwort), TOTP-2FA, HttpOnly/SameSite-Cookies, CSP, Rate-Limit |
| Tests | Vitest (Logik), Playwright (Abläufe, Smartphone + Tablet quer) |
| Betrieb | `docker compose` (App, Datenbank, tägliches Backup) |

## Ordnerstruktur

```
src/
  app/                 Seiten (Next.js App Router)
    anmelden/          Mitarbeiter-Login (Namensliste/Personalnummer + PIN)
    mein/              persönlicher Bereich der Mitarbeiter
    terminal/          Werkstatt-Terminal (ab Meilenstein 2)
    admin/             Verwaltung (eigene Sitzung, Passwort + optional 2FA)
    einrichtung/       Ersteinrichtung: ersten Admin anlegen
    api/health/        Health-Check für Überwachung
  modules/
    auth/              Anmeldung, Sitzungen, PIN-Regeln, Rechteprüfung
    zeiterfassung/     Stempeln, Zeitkonto (ab M2/M3)
    abwesenheit/       Urlaub, Krankheit (ab M4/M5)
    admin/             Einstellungen, Verwaltung
    auftraege/         [später] Arbeitsaufträge / Carisma
  lib/                 Datenbank, Zeit (Europe/Berlin), Krypto, Audit-Log
prisma/                Datenmodell, Migrationen, Testdaten (seed.ts)
docker/                Start- und Backup-Skript
e2e/                   Playwright-Tests
docs/                  Dokumentation (Betrieb, Datenschutz, Anleitungen)
```

## Lokal ausprobieren (mit Docker)

Voraussetzung: [Docker Desktop](https://www.docker.com/products/docker-desktop/) (Windows/Mac) oder Docker unter Linux.

1. `.env` anlegen:

   ```bash
   cp .env.example .env
   ```

   In `.env` diese drei Werte durch beliebige lange Zufallstexte ersetzen:
   `DB_PASSWORD`, `APP_SECRET` (mind. 32 Zeichen) und `SETUP_TOKEN` (mind. 16 Zeichen).
   Für den lokalen Test ohne HTTPS zusätzlich `COOKIE_SECURE="false"` lassen.

2. Starten:

   ```bash
   docker compose up -d --build
   ```

3. Im Browser **http://localhost:3000** öffnen → „Verwaltung (Admin)“ → Sie landen bei der **Ersteinrichtung**.
   Einrichtungscode = Wert von `SETUP_TOKEN` aus `.env`. Danach ist der erste Admin angelegt.

## Lokal entwickeln (ohne Docker für die App)

Voraussetzung: Node.js 22 und eine PostgreSQL-16-Datenbank.

```bash
npm install
cp .env.example .env          # DATABASE_URL anpassen
npx prisma migrate deploy     # Tabellen + Grunddaten anlegen
npm run db:seed               # Testdaten (NUR Entwicklung)
npm run dev                   # http://localhost:3000
```

### Testdaten (nur Entwicklung/Test)

| Wer | Anmeldung |
|---|---|
| alle Mitarbeiter | Name antippen, PIN **4711** |
| „Neu Testperson“ (1010) | Start-PIN **5308** → muss beim ersten Login geändert werden |
| Abteilungsleiter Lack | Thomas Krüger (1002) |
| Admin | Benutzer **admin**, Passwort **Werkstatt-Start-2026!** → muss beim ersten Login geändert werden |
| Terminal | http://localhost:3000/terminal → Freischaltcode **TEST-2026** |

### Tests

```bash
npm test             # Unit-Tests (Vitest)
npm run build        # Produktions-Build
npm run e2e          # E2E-Tests (Playwright) – nutzen eine eigene Datenbank *_e2e
```

Die E2E-Tests verwenden `E2E_DATABASE_URL` (Standard: `postgresql://zeit:zeit@localhost:5432/zeit_e2e`).
Der Datenbankname muss auf `_e2e` enden – die Tests leeren diese Datenbank vor jedem Lauf.

## Backup & Wiederherstellung (Kurzfassung)

Der Dienst `backup` sichert die Datenbank täglich um 02:30 Uhr nach `./backups/` und hebt die Sicherungen 30 Tage auf.

Sofort-Backup:

```bash
docker compose exec backup sh /backup.sh now
```

Wiederherstellen (überschreibt die aktuelle Datenbank!):

```bash
docker compose stop app
docker compose exec -T db psql -U zeit -d postgres -c "DROP DATABASE zeit WITH (FORCE);" -c "CREATE DATABASE zeit OWNER zeit;"
gunzip -c backups/zeiterfassung_JJJJ-MM-TT_HHMM.sql.gz | docker compose exec -T db psql -U zeit -d zeit
docker compose start app
```

Ausführliche Anleitungen (Server, HTTPS, Offsite-Backup, Update-Skript, Probe-Wiederherstellung) folgen in Meilenstein 8 unter `docs/`.

## Update (Kurzfassung)

```bash
docker compose exec backup sh /backup.sh now   # vorher sichern
git pull
docker compose up -d --build                    # Migrationen laufen beim Start automatisch
```
