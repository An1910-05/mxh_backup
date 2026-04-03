#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${1:-/root/mxh}"
SCHEDULE="${2:-15 3 * * *}"
LOG_FILE="${3:-/var/log/mxh-media-cleanup.log}"

CMD="cd ${PROJECT_DIR} && /usr/bin/docker compose exec -T backend php bin/cleanup-media.php >> ${LOG_FILE} 2>&1"
ENTRY="${SCHEDULE} ${CMD}"

TMP_FILE="$(mktemp)"
crontab -l > "${TMP_FILE}" 2>/dev/null || true

if rg -F "${CMD}" "${TMP_FILE}" >/dev/null 2>&1; then
  echo "Cron cleanup entry already exists."
  rm -f "${TMP_FILE}"
  exit 0
fi

{
  cat "${TMP_FILE}"
  echo "${ENTRY}"
} | crontab -

rm -f "${TMP_FILE}"
echo "Installed cron entry:"
echo "${ENTRY}"
