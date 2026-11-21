#!/bin/sh
# Tägliches Datenbank-Backup (läuft im Container "backup").
# - Sicherung als komprimierter pg_dump nach /backups
# - Aufbewahrung: BACKUP_KEEP_DAYS (Standard 30)
# - Uhrzeit: BACKUP_TIME (HH:MM, Standard 02:30, Europe/Berlin)
set -eu
KEEP="${BACKUP_KEEP_DAYS:-30}"
AT="${BACKUP_TIME:-02:30}"

run_backup() {
  ts=$(date +%Y-%m-%d_%H%M)
  file="/backups/zeiterfassung_${ts}.sql.gz"
  echo "[$(date)] Backup → $file"
  pg_dump --no-owner --no-privileges | gzip -9 > "$file.tmp"
  mv "$file.tmp" "$file"
  find /backups -name 'zeiterfassung_*.sql.gz' -mtime +"$KEEP" -delete
  # Hook für die verschlüsselte Kopie außerhalb des Servers (siehe docs/betrieb-und-wartung.md)
  if [ -x /backup-offsite.sh ]; then /backup-offsite.sh "$file" || echo "WARNUNG: Offsite-Kopie fehlgeschlagen"; fi
  echo "[$(date)] fertig"
}

if [ "${1:-}" = "now" ]; then run_backup; exit 0; fi

echo "Backup-Dienst aktiv: täglich um $AT, Aufbewahrung $KEEP Tage"
while true; do
  now=$(date +%s)
  next=$(date -d "$(date +%Y-%m-%d) $AT" +%s 2>/dev/null || date -D '%Y-%m-%d %H:%M' -d "$(date +%Y-%m-%d) $AT" +%s)
  [ "$next" -le "$now" ] && next=$((next + 86400))
  sleep $((next - now))
  run_backup || echo "FEHLER beim Backup"
done
