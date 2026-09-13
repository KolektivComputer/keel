#!/usr/bin/env bash
# Verify anonymously that dev.kolektiv.keel:core and :ktor resolve from the
# advertised Maven repository for a version. Classification mirrors
# publish-maven.sh and the Gradle publishing convention:
#   *-SNAPSHOT  canonical snapshot -> maven-snapshots
#   *SNAPSHOT*  unique pre-release -> keel-maven
#   other       numbered release   -> maven-releases
#
# Usage: verify-maven-resolution.sh [version]
set -uo pipefail

HOST="repo.yuri.capital"
GROUP_PATH="dev/kolektiv/keel"
MODULES=(core ktor)
EXTENSIONS=(pom jar)
CURL=(curl -sS --retry 3 --retry-all-errors --max-time 30 -o /dev/null -w '%{http_code}')

VERSION="${1:-}"
if [ -z "${VERSION}" ]; then
  VERSION="$(grep -E '^version=' gradle.properties | head -n1 | cut -d= -f2 | tr -d '[:space:]')"
fi
if [ -z "${VERSION}" ]; then
  echo "::error::usage: $0 <version> (or run from the repository root)"
  exit 2
fi

case "${VERSION}" in
  *-SNAPSHOT) TARGET_REPO="maven-snapshots"; KIND="canonical snapshot" ;;
  *SNAPSHOT*) TARGET_REPO="keel-maven"; KIND="unique pre-release" ;;
  *) TARGET_REPO="maven-releases"; KIND="numbered release" ;;
esac

BASE="https://${HOST}/repository/${TARGET_REPO}/${GROUP_PATH}"
echo "verifying dev.kolektiv.keel:*:${VERSION} (${KIND}) from ${TARGET_REPO}"

snapshot_value() {
  local module="$1" extension="$2" metadata
  metadata="$(curl -fsS --retry 3 --retry-all-errors --max-time 30 \
    "${BASE}/${module}/${VERSION}/maven-metadata.xml" 2>/dev/null)" || return 1
  printf '%s' "${metadata}" | tr -d '\n' |
    sed -n "s@.*<extension>${extension}</extension><value>\([^<]*\)</value>.*@\1@p"
}

failed=0
for module in "${MODULES[@]}"; do
  for extension in "${EXTENSIONS[@]}"; do
    url="${BASE}/${module}/${VERSION}/${module}-${VERSION}.${extension}"
    code="$("${CURL[@]}" "${url}")"
    if [ "${code}" != "200" ] && [ "${TARGET_REPO}" = "maven-snapshots" ]; then
      value="$(snapshot_value "${module}" "${extension}")"
      if [ -n "${value}" ]; then
        url="${BASE}/${module}/${VERSION}/${module}-${value}.${extension}"
        code="$("${CURL[@]}" "${url}")"
      fi
    fi
    if [ "${code}" = "200" ]; then
      echo "ok   ${url}"
    else
      echo "::error::missing (HTTP ${code}): ${url}"
      failed=1
    fi
  done
done

if [ "${failed}" -ne 0 ]; then
  echo "::error::dev.kolektiv.keel:${VERSION} does not resolve from advertised repository ${TARGET_REPO}"
  exit 1
fi

echo "all artifacts resolve from advertised repository ${TARGET_REPO}"
