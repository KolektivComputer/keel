# Dual npm registries

`@kolektiv/*` packages publish to Yuri Capital today.

Also target GitHub Packages npm:
- registry: `https://npm.pkg.github.com`
- scope: `@kolektiv`
- auth: `NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}` with `packages: write`

JSR: claim `@kolektiv` on jsr.io; add `jsr.json` + OIDC publish (see org `.github` reusable workflow). Not a substitute for npm publish.
