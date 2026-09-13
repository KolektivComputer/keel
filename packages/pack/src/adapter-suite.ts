import assert from "node:assert/strict"
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, relative } from "node:path"
import { test } from "node:test"
import type { RouterAdapter } from "./adapter.ts"

export interface AdapterFixture {
  name: string
  pageFile: string
  layoutFile: string
  idFile: string
  mount: string
  factory: () => RouterAdapter
}

function writeTree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "keel-adapter-files-"))
  for (const [rel, content] of Object.entries(files)) {
    const full = join(root, rel)
    mkdirSync(dirname(full), { recursive: true })
    writeFileSync(full, content)
  }
  return root
}

function relLayouts(pagesDir: string, layouts: string[]): string[] {
  return layouts.map((file) => relative(pagesDir, file).replaceAll("\\", "/"))
}

export function adapterSuite(fixture: AdapterFixture): void {
  const page = fixture.pageFile
  const layout = fixture.layoutFile

  test(`${fixture.name}: nested directories become dotted page ids`, () => {
    const pagesDir = writeTree({ [`harbor/home/${page}`]: "// home\n" })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(found?.id, "harbor.home")
    assert.equal(relative(pagesDir, found?.file ?? "").replaceAll("\\", "/"), `harbor/home/${page}`)
  })

  test(`${fixture.name}: dotted path segments stay in the id`, () => {
    const pagesDir = writeTree({ [`harbor.home/${page}`]: "// home\n" })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(found?.id, "harbor.home")
  })

  test(`${fixture.name}: (groups) are dropped from the id`, () => {
    const pagesDir = writeTree({ [`(app)/harbor/home/${page}`]: "// home\n" })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(found?.id, "harbor.home")
  })

  test(`${fixture.name}: _-prefixed files and dirs are not discovered`, () => {
    const pagesDir = writeTree({
      [`_skip/${page}`]: "// skip\n",
      [`harbor/_hidden/${page}`]: "// hidden\n",
      [`harbor/home/${page}`]: "// home\n",
    })
    const pages = fixture.factory().discover(pagesDir)
    assert.deepEqual(
      pages.map((found) => found.id),
      ["harbor.home"],
    )
  })

  test(`${fixture.name}: the id override file overrides the path id`, () => {
    const pagesDir = writeTree({
      [`x/${page}`]: "// home\n",
      [`x/${fixture.idFile}`]: `export const id = "harbor.home"\n`,
    })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(found?.id, "harbor.home")
  })

  test(`${fixture.name}: layout chain is root-first`, () => {
    const pagesDir = writeTree({
      [layout]: "// root\n",
      [`blog/${layout}`]: "// blog\n",
      [`blog/home/${page}`]: "// home\n",
    })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(found?.id, "blog.home")
    assert.deepEqual(relLayouts(pagesDir, found?.layouts ?? []), [layout, `blog/${layout}`])
  })

  test(`${fixture.name}: group layouts still wrap descendant pages`, () => {
    const pagesDir = writeTree({
      [layout]: "// root\n",
      [`(app)/${layout}`]: "// app\n",
      [`(app)/home/${page}`]: "// home\n",
    })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(found?.id, "home")
    assert.deepEqual(relLayouts(pagesDir, found?.layouts ?? []), [layout, `(app)/${layout}`])
  })

  test(`${fixture.name}: root page without an id override throws`, () => {
    const pagesDir = writeTree({ [page]: "// root\n" })
    assert.throws(() => fixture.factory().discover(pagesDir), /empty page id/)
  })

  test(`${fixture.name}: duplicate ids throw with both file paths`, () => {
    const pagesDir = writeTree({
      [`harbor/home/${page}`]: "// a\n",
      [`harbor.home/${page}`]: "// b\n",
    })
    assert.throws(() => fixture.factory().discover(pagesDir), /duplicate page id 'harbor.home'/)
  })

  test(`${fixture.name}: sibling +head.html is compiled into the discovered page head`, () => {
    const pagesDir = writeTree({
      [`harbor/home/${page}`]: "// home\n",
      "harbor/home/+head.html":
        '<title>{seed.data.title} — Harbor</title>\n<meta name="description" content="A board." />\n<link rel="canonical" href="{seed.path}" />\n',
    })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(
      found?.head,
      '<title>{{data.title}} — Harbor</title>\n<meta name="description" content="A board." />\n<link rel="canonical" href="{{path}}" />',
    )
  })

  test(`${fixture.name}: pages without +head.html have no compiled head`, () => {
    const pagesDir = writeTree({ [`harbor/home/${page}`]: "// home\n" })
    const [found] = fixture.factory().discover(pagesDir)
    assert.equal(found?.head, undefined)
  })

  test(`${fixture.name}: entrySource imports createPage and lists layouts`, () => {
    const source = fixture.factory().entrySource({
      id: "harbor.home",
      file: `/proj/src/pages/harbor/home/${page}`,
      layouts: [`/proj/src/pages/${layout}`, `/proj/src/pages/harbor/${layout}`],
      head: "<title>Harbor</title>",
    })
    assert.equal(
      source,
      [
        `import Page from "/proj/src/pages/harbor/home/${page}"`,
        `import L0 from "/proj/src/pages/${layout}"`,
        `import L1 from "/proj/src/pages/harbor/${layout}"`,
        `import { createPage } from ${JSON.stringify(fixture.mount)}`,
        `export const { mount, unmount, update } = createPage(Page, [L0, L1])`,
        "",
      ].join("\n"),
    )
  })
}
