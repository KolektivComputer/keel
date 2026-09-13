#!/usr/bin/env bash
# Publish @kolektiv/* to the hosted Nexus repo (keel-npm).
# npm-releases / npm-snapshots are groups — read-only, PUT returns 404.
#
# Publishable packages are discovered from packages/*/package.json (every
# non-private @kolektiv/keel* package, sorted by name); adding an adapter
# package needs no change here. DRY_RUN=1 lists them without publishing.
set -euo pipefail

HOST="repo.yuri.capital"
REGISTRY="https://${HOST}/repository/keel-npm/"
SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/../.." && pwd)"
VERSION="$(PKG_MANIFEST="${ROOT_DIR}/packages/core/package.json" node -p 'require(process.env.PKG_MANIFEST).version')"

PACKAGE_LIST="$(node "${SCRIPT_DIR}/list-publishable-packages.mjs" "${ROOT_DIR}/packages")"
PACKAGES=()
while IFS= read -r pkg; do
  [ -n "${pkg}" ] || continue
  PACKAGES+=("${pkg}")
done <<<"${PACKAGE_LIST}"
if [ "${#PACKAGES[@]}" -eq 0 ]; then
  echo "::error::no publishable @kolektiv/keel* packages found under packages/"
  exit 1
fi

if [ -n "${DRY_RUN:-}" ]; then
  echo "dry run: would publish @kolektiv/*@${VERSION} to ${REGISTRY}:"
  printf '  %s\n' "${PACKAGES[@]}"
  exit 0
fi

: "${YURI_CAPITAL_REPO_USERNAME:?set YURI_CAPITAL_REPO_USERNAME}"
: "${YURI_CAPITAL_REPO_PASSWORD:?set YURI_CAPITAL_REPO_PASSWORD}"

AUTH="$(printf '%s:%s' "${YURI_CAPITAL_REPO_USERNAME}" "${YURI_CAPITAL_REPO_PASSWORD}" | openssl base64 -A)"
path="${REGISTRY#https://}"
path="${path#http://}"

NPMRC="$(mktemp)"
trap 'rm -f "${NPMRC}"' EXIT
{
  printf '@kolektiv:registry=%s\n' "${REGISTRY}"
  printf '//%s:_auth=%s\n' "${path}" "${AUTH}"
  printf '//%s:always-auth=true\n' "${path}"
} >"${NPMRC}"

already_published() {
  local pkg="$1"
  NPM_CONFIG_USERCONFIG="${NPMRC}" npm view "${pkg}@${VERSION}" --registry "${REGISTRY}" >/dev/null 2>&1
}

echo "publishing @kolektiv/*@${VERSION} to ${REGISTRY}"
for pkg in "${PACKAGES[@]}"; do
  if already_published "${pkg}"; then
    echo "already published ${pkg}@${VERSION}, skipping"
    continue
  fi
  NPM_CONFIG_USERCONFIG="${NPMRC}" pnpm --filter "${pkg}" publish --no-git-checks --access public --registry "${REGISTRY}"
done
