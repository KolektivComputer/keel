#!/usr/bin/env bash
# Enforce publish boilerplate on @kolektiv/keel* npm packages.
#
# Publishable packages are every non-private package under packages/* whose
# name is @kolektiv/keel or @kolektiv/keel-*, plus any non-private package
# that declares a publishConfig.registry. Each must match the conventions in
# AGENTS.md "Publishing": name scope, version lockstep with packages/core,
# `files` including CHANGELOG.md, a prepack script copying the root
# CHANGELOG.md, and publishConfig.registry pointing at hosted keel-npm.
# A package opts out with "private": true.
#
# Usage: check-publishable-packages.sh [packages-dir]
set -uo pipefail

SCRIPT_DIR="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(CDPATH= cd -- "${SCRIPT_DIR}/../.." && pwd)"
REGISTRY="https://repo.yuri.capital/repository/keel-npm/"
PKG_DIR="${1:-${ROOT_DIR}/packages}"

CORE_MANIFEST="${PKG_DIR}/core/package.json"
if [ ! -f "${CORE_MANIFEST}" ]; then
  echo "::error::missing ${CORE_MANIFEST}; cannot read the lockstep version"
  exit 1
fi
CORE_VERSION="$(PKG_MANIFEST="${CORE_MANIFEST}" node -p 'require(process.env.PKG_MANIFEST).version')"
if [ -z "${CORE_VERSION}" ]; then
  echo "::error::could not read version from ${CORE_MANIFEST}"
  exit 1
fi

failed=0
checked=0
for manifest in "${PKG_DIR}"/*/package.json; do
  [ -f "${manifest}" ] || continue

  if ! fields="$(node - "$manifest" <<'NODE'
const fs = require("node:fs");
const pkg = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const scripts = pkg.scripts || {};
const prepack = typeof scripts.prepack === "string" ? scripts.prepack : "";
const files = Array.isArray(pkg.files) ? pkg.files : [];
const registry =
  pkg.publishConfig && typeof pkg.publishConfig.registry === "string"
    ? pkg.publishConfig.registry
    : "";
process.stdout.write(
  [
    pkg.name || "",
    pkg.version || "",
    pkg.private === true ? "1" : "0",
    registry,
    files.includes("CHANGELOG.md") ? "1" : "0",
    prepack.includes("CHANGELOG.md") && prepack.includes("copyFileSync") ? "1" : "0",
  ].join("\x1f"),
);
NODE
  )"; then
    echo "::error file=${manifest}::could not read ${manifest}"
    failed=1
    continue
  fi

  IFS=$'\x1f' read -r name version is_private registry changelog_ok prepack_ok <<<"${fields}"

  [ "${is_private}" = "1" ] && continue

  in_scope=0
  case "${name}" in
    @kolektiv/keel | @kolektiv/keel-*) in_scope=1 ;;
  esac
  if [ "${in_scope}" -eq 0 ] && [ -z "${registry}" ]; then
    continue
  fi

  checked=$((checked + 1))

  if [ "${in_scope}" -eq 0 ]; then
    echo "::error file=${manifest}::${name}: publishes to a registry but name must match @kolektiv/keel*"
    failed=1
  fi
  if [ -z "${registry}" ]; then
    echo "::error file=${manifest}::${name}: missing publishConfig.registry (expected ${REGISTRY})"
    failed=1
  elif [ "${registry}" != "${REGISTRY}" ]; then
    echo "::error file=${manifest}::${name}: publishConfig.registry is '${registry}', expected '${REGISTRY}'"
    failed=1
  fi
  if [ "${version}" != "${CORE_VERSION}" ]; then
    echo "::error file=${manifest}::${name}: version '${version}' must match packages/core '${CORE_VERSION}'"
    failed=1
  fi
  if [ "${changelog_ok}" != "1" ]; then
    echo "::error file=${manifest}::${name}: files must include CHANGELOG.md"
    failed=1
  fi
  if [ "${prepack_ok}" != "1" ]; then
    echo "::error file=${manifest}::${name}: missing prepack script copying the root CHANGELOG.md"
    failed=1
  fi
done

if [ "${checked}" -eq 0 ]; then
  echo "::error::no publishable @kolektiv/keel* packages found under ${PKG_DIR}"
  exit 1
fi

if [ "${failed}" -ne 0 ]; then
  echo "::error::publishable package boilerplate check failed under ${PKG_DIR}"
  exit 1
fi

echo "checked ${checked} publishable package(s) under ${PKG_DIR}"
