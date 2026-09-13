#!/usr/bin/env bash
# Print the CHANGELOG.md section for a version.
# Usage: changelog-section.sh 0.0.2-SNAPSHOT.1
# Prints the "## [<version>]" heading and everything up to the next "## [" heading.
set -euo pipefail

version="${1:-}"
if [[ -z "${version}" ]]; then
  echo "usage: changelog-section.sh <version>  (for example 0.0.2-SNAPSHOT.1)" >&2
  exit 2
fi

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
changelog="${root}/CHANGELOG.md"

if [[ ! -f "${changelog}" ]]; then
  echo "changelog-section: ${changelog} not found" >&2
  exit 1
fi

section="$(
  awk -v version="${version}" '
    !found { if (index($0, "## [" version "]") == 1) found = 1; if (!found) next }
    /^## \[/ && ++headings > 1 { exit }
    { print }
  ' "${changelog}"
)"

if [[ -z "${section}" ]]; then
  echo "changelog-section: no \"## [${version}]\" section in ${changelog}" >&2
  exit 1
fi

printf '%s\n' "${section}"
