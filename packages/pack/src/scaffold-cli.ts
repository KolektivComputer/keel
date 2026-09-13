#!/usr/bin/env node
import { parseArgs } from "node:util"
import { isScaffoldFramework, scaffoldFrameworks, scaffoldPack } from "./scaffold.ts"

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    schema: { type: "string" },
    framework: { type: "string" },
    id: { type: "string" },
    version: { type: "string" },
    force: { type: "boolean", default: false },
    help: { type: "boolean", default: false },
  },
})

const HELP = `usage: keel-scaffold <origin> <dir>
       keel-scaffold --schema <file.json> <dir>

Fetches GET {origin}/__keel/schema and writes a blank pack.

options:
  --schema <file.json>  offline contract instead of an origin
  --framework <name>    generated framework; choices: ${scaffoldFrameworks.join(", ")}
                        (default: svelte)
  --id <id>             pack id (default: output directory name)
  --version <version>   pack version (default: 0.1.0)
  --force               overwrite existing files
  --help                show this message`

function fail(message: string): never {
  console.error(message)
  process.exit(1)
}

function usage(): never {
  fail(HELP)
}

if (values.help) {
  console.log(HELP)
  process.exit(0)
}

const framework = values.framework ?? "svelte"
if (!isScaffoldFramework(framework)) {
  fail(
    `keel-scaffold: unsupported framework '${framework}'; supported frameworks: ${scaffoldFrameworks.join(", ")}`,
  )
}

try {
  if (values.schema) {
    const outDir = positionals[0]
    if (!outDir) usage()
    const written = await scaffoldPack({
      outDir,
      schemaPath: values.schema,
      framework,
      id: values.id,
      version: values.version,
      force: values.force,
    })
    console.log(`wrote ${written.length} files in ${outDir}`)
  } else {
    const origin = positionals[0]
    const outDir = positionals[1]
    if (!origin || !outDir) usage()
    const written = await scaffoldPack({
      outDir,
      origin,
      framework,
      id: values.id,
      version: values.version,
      force: values.force,
    })
    console.log(`wrote ${written.length} files in ${outDir}`)
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
