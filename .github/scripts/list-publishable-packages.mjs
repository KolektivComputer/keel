#!/usr/bin/env node
// List publishable npm packages under a directory: every non-private
// @kolektiv/keel* package, one name per line, sorted deterministically.
//
// Usage: node list-publishable-packages.mjs [packages-dir]
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const dir = process.argv[2] ?? "packages";
const namePattern = /^@kolektiv\/keel(?:$|-)/;
const names = [];

for (const entry of readdirSync(dir, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const manifest = join(dir, entry.name, "package.json");
  if (!existsSync(manifest)) continue;
  const pkg = JSON.parse(readFileSync(manifest, "utf8"));
  if (pkg.private === true) continue;
  if (typeof pkg.name !== "string" || !namePattern.test(pkg.name)) continue;
  names.push(pkg.name);
}

names.sort();

if (names.length === 0) {
  console.error(`no publishable @kolektiv/keel* packages found under ${dir}`);
  process.exit(1);
}

process.stdout.write(`${names.join("\n")}\n`);
