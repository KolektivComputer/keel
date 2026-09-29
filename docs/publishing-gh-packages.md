# Optional GitHub Packages dual

Primary publish and consume stay on Kolektiv Nexus:

- Maven: `maven-releases` or `maven-snapshots` on `repo.kolektiv.computer`
- npm: `https://repo.kolektiv.computer/repository/npm-public/`

GitHub Packages is optional dual only (never first for consumers):

- Maven: `https://maven.pkg.github.com/KolektivComputer/keel`
- npm: `https://npm.pkg.github.com`, scope `@kolektiv`
- auth: `NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}` with `packages: write`

JSR: claim `@kolektiv` on jsr.io; add `jsr.json` + OIDC publish (see org `.github` reusable workflow). Not a substitute for npm publish.
