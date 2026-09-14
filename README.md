<p align="center">
  <img src="public/logo.svg" alt="Keel" width="96" height="96" />
</p>

# Keel

Host-owned routing and render-time frontend packs for Kotlin servers.

**Docs:** [Getting started](https://keel.kolektiv.computer/docs/getting-started/) · [keel.kolektiv.computer](https://keel.kolektiv.computer/)

| Coordinate | Name |
| --- | --- |
| Maven | `dev.kolektiv.keel:core`, `dev.kolektiv.keel:ktor` |
| npm router | `@kolektiv/keel` |
| npm adapters | `@kolektiv/keel-svelte`, `@kolektiv/keel-react`, `@kolektiv/keel-vue`, `@kolektiv/keel-solid`, `@kolektiv/keel-preact`, `@kolektiv/keel-lit`, `@kolektiv/keel-angular` |
| npm pack toolchain | `@kolektiv/keel-pack` |
| Org | [KolektivComputer](https://github.com/KolektivComputer) · [kolektiv.computer](https://kolektiv.computer) |

## License

[Apache License 2.0](./LICENSE) © Kolektiv Computer

## Start here

- [Getting started](https://keel.kolektiv.computer/docs/getting-started/)
- [AGENTS.md](./AGENTS.md): how to work in this repo (humans and coding agents)
- [CHANGELOG.md](./CHANGELOG.md)
- [llms.txt](./llms.txt): curated map for LLMs (also served from the docs site)

## Layout

- `buildSrc/`: Kotlin JVM + Maven publish conventions
- `lib/`: seed, manifest, page registry, `FrontendBundle`, typegen (no Ktor)
- `ktor/`: Ktor plugin: document shell, `respondPage`, visits, pack static files
- `samples/harbor`: Harbor testbench (Ktor + Svelte pack). Not the product path. `./gradlew :samples:harbor:run`
- `packages/`: TypeScript router, framework adapters, and `keel-pack` (`.feb` zip + `keel-scaffold`)
- `skills/`: Agent Skills (`keel-host`, `keel-pack`, `keel-scaffold`)
- `docs/`: homepage and documentation (Astro)

```bash
./gradlew :lib:test :ktor:test :samples:harbor:test
pnpm install
pnpm test
pnpm build:packages
pnpm dev
./gradlew :samples:harbor:run
```

Java 17+, Kotlin 2.2, Gradle 9.5. CI runs JVM tests on JDK 17 / 21 / 25 and the JS workspace on Node 22.

Implementing guides: [Wire protocol](https://keel.kolektiv.computer/docs/implementing/protocol/) and siblings under `/docs/implementing/`.

## Publishing

Consumers resolve **one** Maven repo — `maven-releases` for numbered
versions, `maven-snapshots` for canonical `*-SNAPSHOT` builds, or
`keel-maven` for unique pre-releases like `0.0.2-SNAPSHOT.4` — never more
than one. npm resolves from hosted `keel-npm`. Maintainers publish Maven to
`keel-maven`, plus `maven-snapshots` for canonical snapshots or
`maven-releases` for numbered releases; unique pre-releases go to
`keel-maven` only. Credentials: GitHub Actions secrets
`YURI_CAPITAL_REPO_USERNAME` / `YURI_CAPITAL_REPO_PASSWORD`, or the same
names as env, or `keel.publishing.yuriCapitalRepoUsername` /
`keel.publishing.yuriCapitalRepoPassword` in `~/.gradle/gradle.properties`.
`.github/workflows/publish.yml`.

The pnpm workspace lives at the repository root (`packages/*` and `docs`).

Docs deploy to Cloudflare Pages through its Git integration (project `keel-docs`)
at [keel.kolektiv.computer](https://keel.kolektiv.computer/). The Pages production
branch is `docs/v0.1.0-release-scrub` until this work merges to `main`.
