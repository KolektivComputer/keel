# Developing

Local loop:

```bash
pnpm install
pnpm test && pnpm typecheck
pnpm build:packages
pnpm dev   # docs at http://127.0.0.1:8080
./gradlew :samples:harbor:run   # Harbor testbench at http://127.0.0.1:8090
```

Host and pack contracts: [Implementing Keel](https://keel.kolektiv.computer/docs/implementing/protocol/).
Agent Skills: `skills/` (`keel-host`, `keel-pack`, `keel-scaffold`).
