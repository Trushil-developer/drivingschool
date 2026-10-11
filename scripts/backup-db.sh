#!/usr/bin/env bash
# Back up the database to ~/backups/<kind>/ and keep only the newest 7.
#
#   scripts/backup-db.sh daily       # nightly, from cron
#   scripts/backup-db.sh predeploy   # before every deploy (deploy.yml)
#
# If BACKUP_S3_URI is set (e.g. s3://bucket/db-backups), the backup is also
# uploaded there and that S3 folder is trimmed to the newest 7 as well — an
# off-server copy that survives losing the EC2 instance. Only files named
# <DB_NAME>_*.sql.gz inside that folder are ever deleted.
#
# Reads DB_HOST / DB_USER / DB_PASSWORD / DB_NAME from the app's .env.
# Exits non-zero (and keeps the previous backups) if the dump fails or is
# incomplete, so a deploy never continues without a good backup.
#
# Restore:
#   gunzip < ~/backups/daily/<file>.sql.gz | mysql -u root -p drivingschool

set -euo pipefail

KIND="${1:-daily}"
KEEP=7
APP_DIR="$(cd "$(dirname "$0")/.." && pwd)"
DIR="$HOME/backups/$KIND"

set -a
# shellcheck disable=SC1091
. "$APP_DIR/.env"
set +a
export MYSQL_PWD="$DB_PASSWORD"

mkdir -p "$DIR"
FILE="$DIR/${DB_NAME}_$(date +%F_%H%M%S).sql.gz"
TMP="$FILE.partial"
trap 'rm -f "$TMP"' EXIT

mysqldump -h "${DB_HOST:-localhost}" -u "$DB_USER" \
  --single-transaction --no-tablespaces --routines --triggers --events \
  --set-gtid-purged=OFF "$DB_NAME" | gzip > "$TMP"

# Only keep it if it's a valid archive of a dump that ran to the end.
gzip -t "$TMP"
gunzip -c "$TMP" | tail -n 1 | grep -q "Dump completed"
mv "$TMP" "$FILE"

# Rotate: newest $KEEP stay, everything older is deleted.
ls -1t "$DIR"/*.sql.gz | tail -n +$((KEEP + 1)) | xargs -r rm -f

echo "Backup OK: $FILE ($(du -h "$FILE" | cut -f1)); $(ls -1 "$DIR"/*.sql.gz | wc -l) kept in $DIR"

if [ -n "${BACKUP_S3_URI:-}" ]; then
  S3="${BACKUP_S3_URI%/}"
  aws s3 cp --only-show-errors "$FILE" "$S3/$(basename "$FILE")"
  # Names sort by date, so everything after the newest $KEEP is older.
  OLD=$(aws s3 ls "$S3/" | awk '{print $4}' | grep -E "^${DB_NAME}_.*\.sql\.gz$" | sort -r \
        | tail -n +$((KEEP + 1)) || true)
  for old in $OLD; do
    aws s3 rm --only-show-errors "$S3/$old"
  done
  echo "Uploaded to $S3/; $(aws s3 ls "$S3/" | grep -cE "${DB_NAME}_.*\.sql\.gz$") kept there"
fi
