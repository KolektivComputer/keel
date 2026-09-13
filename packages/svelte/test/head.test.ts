import assert from "node:assert/strict"
import { test } from "node:test"
import {
  applyHead,
  fromPageHead,
  KEEL_HEAD_ATTR,
  setTitle,
  syncHead,
} from "@kolektiv/keel"
import * as adapter from "../dist/head.js"

test("svelte head helpers are the core DOM helpers", () => {
  assert.equal(adapter.applyHead, applyHead)
  assert.equal(adapter.setTitle, setTitle)
  assert.equal(adapter.syncHead, syncHead)
  assert.equal(adapter.fromPageHead, fromPageHead)
  assert.equal(adapter.KEEL_HEAD_ATTR, KEEL_HEAD_ATTR)
})
