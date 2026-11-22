# Modul „Arbeitsaufträge“ – vorgesehene Erweiterung

> Stand: vorbereitet, **noch nicht gebaut**. Dieses Dokument beschreibt, was bereits angelegt ist und wie das Modul später ergänzt wird.

## Ziel

Mitarbeiter arbeiten Aufträge in der App ab und buchen ihre Zeit auf Aufträge. Daraus entsteht ein **Soll/Ist-Vergleich**: verkaufte **Arbeitswerte (AW)** aus Audatex Carisma vs. tatsächlich geleistete **produktive** Zeit – je Abteilung (**Karosserie inkl. Mechanik**, **Lack**) und innerhalb Lack je **Arbeitsbereich** (Vorarbeit, Lackierung, Finish), wobei die Lack-AW pro Auftrag frei aufgeteilt werden.

## Bereits vorhanden

### Datenmodell (`prisma/schema.prisma`, markiert mit `[AUFTRAEGE]`)

| Tabelle | Zweck |
|---|---|
| `Order` | Auftrag: `externalRef` (Carisma-Nr.), `source` (carisma/kunden-app/manuell), `title`, `vehicleRef` (z. B. Kennzeichen), `status` (OFFEN, IN_ARBEIT, FERTIG, ABGERECHNET) |
| `OrderPosition` | Position mit verkauften AW (`soldAw`), Zuordnung `departmentId` + optional `workArea` (Vorarbeit/Lackierung/Finish), `splitFromId` für aufgeteilte Positionen |
| `TimeEntry` | Zeitintervalle der Stempeluhr; zusätzlich `orderId`, `orderPositionId`, `productive` (produktiv/unproduktiv) und `departmentId` (wo gearbeitet wurde) |
| `Department.productive` | ob eine Abteilung in die AW-Auswertung eingeht (Büro: nein) |
| Einstellung `minutesPerAw` | Umrechnung 1 AW = 6 Min. (10 AW = 1 Std.), anpassbar |

Die bestehende Zeiterfassung (Anwesenheit, Pausen, Zeitkonto) bleibt unverändert. Auftragsbuchungen sind **Unterteilungen der Anwesenheitszeit**: Ein Arbeitsblock kann in mehrere `TimeEntry`-Abschnitte mit Auftragsbezug geteilt werden – die Summe bleibt gleich, das Zeitkonto ist nicht betroffen.

### Rechenkern (`src/modules/auftraege/types.ts`, getestet)

- `awToMinutes` / `minutesToAw`
- `splitAw(total, anteile)` – freie Aufteilung der Lack-AW auf Arbeitsbereiche (100 %)
- `sollIst(positionen, buchungen)` – Soll (AW→Minuten) vs. Ist (nur produktive Zeit) je Abteilung/Arbeitsbereich inkl. Leistungsgrad

### Schnittstellen (`src/modules/auftraege/service.ts`)

- `OrderSource` – Quelle für Aufträge (`carisma`, `kunden-app`, `manuell`) mit `fetchSince()`
- `ImportedOrder`, `OrderTimeBooking` – Datenverträge
- REST-Platzhalter `GET/POST /api/v1/auftraege` (antwortet derzeit mit 501 „geplant“)

### Oberfläche

Menüpunkt **„Aufträge“** (Mitarbeiter und Admin) als Platzhalter.

## Geplanter Ausbau (Vorschlag)

1. **Auftragsverwaltung (Admin)**: Aufträge anlegen/importieren, Positionen den Abteilungen zuordnen, Lack-AW per Schieberegler/Prozent auf Vorarbeit/Lackierung/Finish verteilen.
2. **Carisma-Import**: zunächst Datei-Import (Export aus Carisma, z. B. Kalkulation/Rechnung als PDF/XML/CSV – Format mit Audatex klären), später automatische Schnittstelle. Zuordnung der Carisma-Arbeitspositionen (Karosserie, Mechanik, Lack) zu Abteilungen über eine Mapping-Tabelle.
3. **Zeitbuchung am Terminal/Handy**: nach „Kommen“ Auftrag wählen (Liste der offenen Aufträge der Abteilung, Suche nach Kennzeichen/Auftragsnr.), Wechsel zwischen Aufträgen, „unproduktiv“ (Werkstatt aufräumen, Fahrzeug holen …).
4. **Auswertung**: Soll/Ist je Auftrag, Abteilung, Arbeitsbereich, Mitarbeiter und Zeitraum; Leistungsgrad; Export.
5. **Kunden-App** (Schadenmeldung): Übernahme als Auftragsentwurf über `OrderSource "kunden-app"` (eigene, abgesicherte API mit Token).

### Datenschutz-Hinweis

Leistungsauswertungen pro Mitarbeiter sind mitbestimmungs- und datenschutzrelevant (Verhaltens- und Leistungskontrolle). Vor Einführung: Zweck festlegen, Beschäftigte informieren, Auswertungen möglichst auf Abteilungs-/Auftragsebene.
