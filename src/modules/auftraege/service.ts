/**
 * [AUFTRAEGE] Saubere Schnittstellen für das spätere Modul – bewusst noch ohne Umsetzung.
 * Die Oberfläche und die Carisma-Anbindung werden gegen diese Verträge gebaut.
 */
import type { OrderPositionInput } from "./types";

/** Quelle für Aufträge, z. B. Audatex Carisma (Export/Schnittstelle) oder Kunden-App (Schadenmeldung) */
export interface OrderSource {
  name: "carisma" | "kunden-app" | "manuell";
  /** neue/aktualisierte Aufträge seit Zeitpunkt abrufen */
  fetchSince(since: Date): Promise<ImportedOrder[]>;
}

export interface ImportedOrder {
  externalRef: string;
  title: string;
  vehicleRef?: string;
  positions: (OrderPositionInput & { externalPositionRef?: string })[];
}

/** Zeitbuchung auf einen Auftrag (Mitarbeiter wählt Auftrag/Position am Terminal oder Handy) */
export interface OrderTimeBooking {
  employeeId: string;
  orderId: string;
  orderPositionId?: string;
  productive: boolean;
  start: Date;
  end?: Date;
}

export class NotYetAvailableError extends Error {
  constructor() {
    super("Das Modul „Arbeitsaufträge“ ist in Vorbereitung.");
  }
}
