# Verzeichnis von Verarbeitungstätigkeiten (Art. 30 Abs. 1 DSGVO)

> **ENTWURF – zur Prüfung durch den Datenschutzberater.** Vom Verantwortlichen zu ergänzen und zu unterschreiben. Platzhalter sind in `[eckigen Klammern]`.

## 1. Verantwortlicher

| | |
|---|---|
| Name | Bludau GmbH (Autoklinik Bludau) |
| Anschrift | Wodanstraße 38, 38106 Braunschweig |
| Vertretungsberechtigte Person | [Name Geschäftsführung] |
| Kontakt | [Telefon, E-Mail] |
| Datenschutzbeauftragte/r | [Name/Kontakt, falls bestellt – sonst „nicht bestellt (nicht verpflichtet)“] |

## 2. Bezeichnung der Verarbeitungstätigkeit

**Elektronische Arbeitszeiterfassung, Urlaubs- und Abwesenheitsverwaltung** (Web-App „Zeiterfassung Bludau“)

## 3. Zwecke der Verarbeitung

- Erfassung von Beginn, Ende und Pausen der Arbeitszeit (Pflicht zur Arbeitszeiterfassung, § 16 Abs. 2 ArbZG, BAG-Beschluss vom 13.09.2022 – 1 ABR 22/21)
- Führung von Arbeitszeitkonten (Soll/Ist, Mehr- und Minderstunden)
- Einhaltung des Arbeitszeitgesetzes (Pausen, Höchstarbeitszeit, Ruhezeiten)
- Verwaltung von Urlaub (BUrlG) und sonstigen Abwesenheiten
- Erfassung von Arbeitsunfähigkeitszeiten für die Entgeltfortzahlung (EFZG) und das Betriebliche Eingliederungsmanagement (§ 167 Abs. 2 SGB IX)
- Vorbereitung der Lohnabrechnung (Übergabe an Lohnbüro/Steuerberater)
- Personaleinsatzplanung (Anwesenheitsübersicht, Mindestbesetzung)

## 4. Rechtsgrundlagen

- Art. 6 Abs. 1 lit. b DSGVO i. V. m. § 26 Abs. 1 BDSG (Durchführung des Beschäftigungsverhältnisses)
- Art. 6 Abs. 1 lit. c DSGVO (rechtliche Verpflichtungen: § 16 ArbZG, § 17 MiLoG [falls einschlägig], steuer- und sozialversicherungsrechtliche Aufbewahrungspflichten)
- Art. 9 Abs. 2 lit. b DSGVO i. V. m. § 26 Abs. 3 BDSG für Arbeitsunfähigkeitszeiten (Gesundheitsdaten im weiteren Sinne – es werden **keine Diagnosen** gespeichert)

## 5. Kategorien betroffener Personen

- Beschäftigte (Vollzeit, Teilzeit, Aushilfen), Auszubildende [falls künftig], Geschäftsführung/Büro (Admin-Konten)

## 6. Kategorien personenbezogener Daten

| Kategorie | Daten |
|---|---|
| Stammdaten | Personalnummer, Vor- und Nachname, Abteilung, Eintritts-/Austrittsdatum, Rolle, optional E-Mail |
| Zugangsdaten | PIN (nur als Argon2id-Hash), Admin: Benutzername, Passwort-Hash, 2FA-Schlüssel (verschlüsselt) |
| Arbeitszeitdaten | Stempelzeitpunkte (Kommen, Pause, Gehen), Quelle (Terminal/Handy), Offline-Kennzeichen, IP-Adresse des Geräts beim Stempeln, Korrekturen mit Begründung |
| Arbeitszeitmodell | Wochenstunden, Soll-Zeit je Wochentag |
| Zeitkonto | Salden, Buchungen (Übertrag, Freizeitausgleich, Auszahlung), Monatsabschlüsse und Bestätigungen |
| Abwesenheiten | Urlaub, Sonderurlaub, unbezahlter Urlaub, Freizeitausgleich, Berufsschule/Schulung; Anträge, Entscheidungen, Begründungen |
| Arbeitsunfähigkeit | **nur** Zeitraum, „AU liegt vor“, „eAU abgerufen“, „Kind krank“ – **keine Diagnosen, keine Bescheinigungen** |
| Protokolle | Änderungsprotokoll (wer hat wann was warum geändert), Anmeldeversuche (Zeit, Erfolg, IP) |

**Nicht** verarbeitet: GPS-/Standortdaten, Fotos, biometrische Daten, Diagnosen.

## 7. Empfänger

| Empfänger | Daten | Grundlage |
|---|---|---|
| Geschäftsführung/Büro (Admins) | alle Daten | Zugriff nach Rolle |
| Abteilungsleiter | Anwesenheit, Urlaubsanträge, Korrekturanträge der eigenen Abteilung; Krankheit nur als „abwesend“ | Zugriff nach Rolle |
| Kollegen | Abwesenheit im Abteilungskalender nur als „abwesend“ (einstellbar) | berechtigtes Interesse Einsatzplanung |
| Lohnbüro/Steuerberater [Name] | Monatswerte (Lohnliste) | Art. 28 DSGVO (AVV) bzw. eigene Verantwortlichkeit [prüfen] |
| Hosting-Anbieter [Name, z. B. Hetzner Online GmbH] | technischer Betrieb (Server in Deutschland) | Auftragsverarbeitung, AVV nach Art. 28 DSGVO |
| Backup-Speicher [Name] | verschlüsselte Datensicherung | Auftragsverarbeitung, AVV |

## 8. Übermittlung in Drittländer

Keine. Server und Backups in Deutschland. Die App lädt keine externen Schriftarten, CDNs, Analyse- oder Tracking-Dienste.

## 9. Löschfristen

| Daten | Frist |
|---|---|
| Arbeitszeitnachweise | mindestens 2 Jahre (§ 16 Abs. 2 ArbZG) |
| lohnrelevante Daten (Monatswerte, Abwesenheiten) | [6/8/10] Jahre nach Ende des Kalenderjahres (§ 41 EStG, § 147 AO, § 257 HGB – mit Steuerberater abstimmen) |
| Mitarbeiter nach Austritt | automatische Anonymisierung nach eingestellter Frist (Standard 6 Jahre nach Ende des Austrittsjahres); Krankmeldungen werden dabei gelöscht |
| Anmeldeprotokoll | 90 Tage (automatisch) |
| gelesene Benachrichtigungen | 180 Tage (automatisch) |
| Datensicherungen | 30 Tage auf dem Server; Offsite-Kopie [Frist] |

## 10. Technische und organisatorische Maßnahmen (Art. 32 DSGVO) – Kurzfassung

- Verschlüsselte Übertragung (HTTPS, automatisch erneuerte Zertifikate), HSTS
- Server in Deutschland, Firewall (nur Ports 22/80/443), SSH nur mit Schlüssel, automatische Sicherheitsupdates, Fail2ban
- Rollen- und Rechtekonzept mit **serverseitiger** Prüfung bei jeder Anfrage
- PIN/Passwörter nur als Argon2id-Hash; Sperre nach 5 Fehlversuchen; Rate-Limit; optional verpflichtende 2FA für Admins; getrennte Admin-Sitzung mit 30 Minuten Inaktivitäts-Timeout
- Sichere Cookies (HttpOnly, Secure, SameSite=Strict), CSRF-Schutz, Content-Security-Policy
- Lückenloses Änderungsprotokoll; Originalbuchungen werden nie gelöscht
- Datensparsamkeit (keine Diagnosen, kein GPS), Anonymisierung nach Fristablauf
- Tägliche Datensicherung (30 Tage) + verschlüsselte Kopie außerhalb des Servers, regelmäßige Rücksicherungstests
- Terminal-Tablet: Kiosk-Modus, Freischaltung nur per Einmal-Code durch Admin

## 11. Datum, Unterschrift

[Ort, Datum] – [Unterschrift Geschäftsführung]
