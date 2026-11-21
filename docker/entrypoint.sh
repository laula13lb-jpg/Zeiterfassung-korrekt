#!/bin/sh
set -e
echo "Datenbank-Migrationen einspielen …"
./node_modules/.bin/prisma migrate deploy
echo "Starte App …"
exec ./node_modules/.bin/next start -H 0.0.0.0 -p "${PORT:-3000}"
