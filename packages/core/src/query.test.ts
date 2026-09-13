import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_PAGE_QUERY_KEY, pageQueryKey } from "./query.ts"

test("the root page query key is the shared current-page key", () => {
  assert.deepEqual(KEEL_PAGE_QUERY_KEY, ["keel", "page"])
})

test("path keys extend the root key", () => {
  assert.deepEqual(pageQueryKey("/p/hello"), ["keel", "page", "/p/hello"])
  assert.deepEqual(pageQueryKey("/"), ["keel", "page", "/"])
})
