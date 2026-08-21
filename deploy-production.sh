#!/usr/bin/env bash

set -Eeuo pipefail

release_id="${1:?Usage: deploy-production.sh RELEASE_ID ARCHIVE_PATH}"
archive_path="${2:?Usage: deploy-production.sh RELEASE_ID ARCHIVE_PATH}"
app_root="/var/www/tnservice.vn"
web_root="$app_root/public"
deploy_root="$app_root/.deploy"
stage_root="$deploy_root/staging"
backup_root="$deploy_root/backups"
stage_path="$stage_root/$release_id"
backup_path="$backup_root/$release_id"
lock_path="$deploy_root/deploy.lock"

if [[ ! "$release_id" =~ ^[0-9a-f]{40}$ ]]; then
  echo "Invalid release id: $release_id" >&2
  exit 1
fi

if [[ "$archive_path" != "/tmp/tncompany-release-$release_id.tar.gz" ]]; then
  echo "Unexpected archive path: $archive_path" >&2
  exit 1
fi

if [[ ! -f "$archive_path" ]]; then
  echo "Release archive does not exist: $archive_path" >&2
  exit 1
fi

if [[ ! -d "$web_root" || ! -d "$web_root/uploads" ]]; then
  echo "Production web root or shared uploads directory is missing." >&2
  exit 1
fi

command -v flock >/dev/null
command -v rsync >/dev/null
command -v curl >/dev/null

mkdir -p "$stage_root" "$backup_root"
exec 9>"$lock_path"
if ! flock -n 9; then
  echo "Another production deployment is already running." >&2
  exit 1
fi

cleanup() {
  rm -f -- "$archive_path" "/tmp/tncompany-deploy-$release_id.sh"
  if [[ -d "$stage_path" ]]; then
    rm -rf -- "$stage_path"
  fi
}
trap cleanup EXIT

if [[ -d "$stage_path" ]]; then
  rm -rf -- "$stage_path"
fi
mkdir -p "$stage_path" "$backup_path"
tar -xzf "$archive_path" -C "$stage_path"

for required_file in index.html spa-shell.html .htaccess api/health.php; do
  if [[ ! -f "$stage_path/$required_file" ]]; then
    echo "Release is missing required file: $required_file" >&2
    exit 1
  fi
done

# Preserve the currently working code before changing production. Runtime
# uploads are shared data and are deliberately excluded from every deployment.
rsync -a --delete --exclude '/uploads/' "$web_root/" "$backup_path/"

rollback() {
  echo "Health check failed; restoring the previous release." >&2
  rsync -a --delete --exclude '/uploads/' "$backup_path/" "$web_root/"
}

if ! rsync -a --delete-delay --exclude '/uploads/' "$stage_path/" "$web_root/"; then
  rollback
  exit 1
fi

# Deployed code only needs to be readable by Apache. The writable uploads tree
# is pruned here so its existing www-data group ownership/modes stay unchanged.
if ! find "$web_root" -path "$web_root/uploads" -prune -o -type d -exec chmod 755 {} +; then
  rollback
  exit 1
fi
if ! find "$web_root" -path "$web_root/uploads" -prune -o -type f -exec chmod 644 {} +; then
  rollback
  exit 1
fi

health_response=""
if ! health_response="$(curl --fail --silent --show-error --max-time 15 \
  --resolve tnservice.vn:443:127.0.0.1 \
  https://tnservice.vn/api/health.php)"; then
  rollback
  exit 1
fi

if ! grep -Eq '"ok"[[:space:]]*:[[:space:]]*true' <<<"$health_response"; then
  echo "Unexpected health response: $health_response" >&2
  rollback
  exit 1
fi

printf '%s\n' "$health_response"
echo "Production release $release_id deployed successfully."

# Keep the five newest code backups. Each path is checked before deletion.
mapfile -t expired_backups < <(
  find "$backup_root" -mindepth 1 -maxdepth 1 -type d -printf '%T@ %p\n' \
    | sort -nr \
    | awk 'NR > 5 { sub(/^[^ ]+ /, ""); print }'
)
for expired_backup in "${expired_backups[@]}"; do
  case "$expired_backup" in
    "$backup_root"/*) rm -rf -- "$expired_backup" ;;
    *) echo "Refusing to remove unexpected backup path: $expired_backup" >&2 ;;
  esac
done
