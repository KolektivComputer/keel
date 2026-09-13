#!/usr/bin/env bash
# Verify anonymously that @kolektiv/* at a version resolves from the
# advertised npm registry (hosted keel-npm).
#
# Publishable packages are discovered from packages/*/package.json (every
# non-private @kolektiv/keel* package, sorted by name).
#
# Usage: verify-npm-resolution.sh [version]
set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/../.." && pwd)"
REGISTRY="https://repo.yuri.capital/repository/keel-npm/"

VERSION="${1:-}"
if [ -z "${VERSION}" ]; then
  VERSION="$(PKG_MANIFEST="${ROOT_DIR}/packages/core/package.json" node -p 'require(process.env.PKG_MANIFEST).version' 2>/dev/null)"
fi
if [ -z "${VERSION}" ]; then
  echo "::error::usage: $0 <version> (or run with node and packages/core/package.json available)"
  exit 2
fi

PACKAGE_LIST="$(node "${SCRIPT_DIR}/list-publishable-packages.mjs" "${ROOT_DIR}/packages")"
PACKAGES=()
while IFS= read -r pkg; do
  [ -n "${pkg}" ] || continue
  PACKAGES+=("${pkg}")
done <<<"${PACKAGE_LIST}"
if [ "${#PACKAGES[@]}" -eq 0 ]; then
  echo "::error::no publishable @kolektiv/keel* packages found under packages/"
  exit 2
fi

echo "verifying @kolektiv/*:${VERSION} from ${REGISTRY}"

failed=0
for package in "${PACKAGES[@]}"; do
  if npm view "${package}@${VERSION}" version --registry "${REGISTRY}" \
    --fetch-retries=3 >/dev/null 2>&1; then
    echo "ok   ${package}@${VERSION}"
  else
    echo "::error::missing: ${package}@${VERSION}"
    failed=1
  fi
done

if [ "${failed}" -ne 0 ]; then
  echo "::error::@kolektiv/*:${VERSION} does not resolve from advertised registry ${REGISTRY}"
  exit 1
fi

echo "all packages resolve from advertised registry ${REGISTRY}"
