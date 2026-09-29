# Publish notes (Kolektiv Nexus + optional GH Packages)

Org epic: [KolektivComputer/.github#2](https://github.com/KolektivComputer/.github/issues/2)
Spine: [gradle-conventions](https://github.com/KolektivComputer/gradle-conventions) → plugin `computer.kolektiv.publishing`

## Maven (primary)

- Host: `https://repo.kolektiv.computer/`
- GroupId: `computer.kolektiv.keel` (org family `computer.kolektiv.*`)
- Publish to **one** of `maven-releases` or `maven-snapshots` (never both, never `maven-public`)
- GitHub Packages (`https://maven.pkg.github.com/KolektivComputer/keel`) stays optional dual when `GITHUB_ACTOR` / `GITHUB_TOKEN` are present. It is never the first consumer path.

## npm (primary)

- Scope **`@kolektiv/...` only**
- Publish and consume: `https://repo.kolektiv.computer/repository/npm-public/`
- Optional dual: `https://npm.pkg.github.com` with `@kolektiv:registry=…` when you already dual-publish. Never first for consumers.
- Auth secrets keep the names `YURI_CAPITAL_REPO_USERNAME` / `YURI_CAPITAL_REPO_PASSWORD`

## JSR

- Scope `@kolektiv` (owned)
- Actions: OIDC only — `permissions.id-token: write` — **no org `JSR_TOKEN`**
- Mey: link each package on jsr.io for GitHub Actions trusted publishing
- Not a substitute for npm publish

## Workflow paste

```yaml
permissions:
  contents: read
  packages: write
  id-token: write  # JSR OIDC
```

Maven job env:
```yaml
GITHUB_ACTOR: ${{ github.actor }}
GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
YURI_CAPITAL_REPO_USERNAME: ${{ secrets.YURI_CAPITAL_REPO_USERNAME }}
YURI_CAPITAL_REPO_PASSWORD: ${{ secrets.YURI_CAPITAL_REPO_PASSWORD }}
```

Optional npm → GitHub Packages (never first):
```yaml
- uses: actions/setup-node@v4
  with:
    registry-url: https://npm.pkg.github.com
    scope: "@kolektiv"
env:
  NODE_AUTH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Docker images (sibling products): `docker.kolektiv.computer/kolektiv/<image>`.

Maven group is `computer.kolektiv.keel`. npm stays `@kolektiv/*`.
