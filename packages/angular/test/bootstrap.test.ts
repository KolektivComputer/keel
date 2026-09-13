import "./setup.ts"
import assert from "node:assert/strict"
import { test } from "node:test"
import { KEEL_PAGE_QUERY_KEY } from "@kolektiv/keel"
import { getQueryClient, pageQueryKey } from "../dist/index.js"
import { bootstrap } from "../dist/bootstrap.js"
import { seed } from "./helpers.ts"

type Call = [string, unknown]

const ENTRY =
  "data:text/javascript," +
  encodeURIComponent(
    [
      "export function mount(host, ctx) { (globalThis.__keelCalls ??= []).push(['mount', ctx]) }",
      "export function unmount() { (globalThis.__keelCalls ??= []).push(['unmount']) }",
      "export function update(ctx) { (globalThis.__keelCalls ??= []).push(['update', ctx]) }",
    ].join("\n"),
  )

test("bootstrap hydrates the query cache before the caller's onSeed runs", async () => {
  const calls: Call[] = []
  ;(globalThis as { __keelCalls?: Call[] }).__keelCalls = calls

  const page = seed("/", { title: "Home" })
  page.entry = ENTRY

  const json = document.createElement("script")
  json.id = "__keel_seed"
  json.type = "application/json"
  json.textContent = JSON.stringify(page)
  document.body.append(json)
  const hostElement = document.createElement("div")
  hostElement.id = "__keel_root"
  document.body.append(hostElement)

  const client = getQueryClient()
  client.clear()
  const phases: string[] = []
  const seenInHook: unknown[] = []

  await bootstrap({
    focusOnNavigate: false,
    onSeed(seedValue, phase) {
      phases.push(phase)
      seenInHook.push(client.getQueryData(KEEL_PAGE_QUERY_KEY))
      seenInHook.push(client.getQueryData(pageQueryKey(seedValue.path)))
    },
  })

  assert.deepEqual(phases, ["initial"])
  assert.equal(seenInHook[0], seenInHook[1])
  assert.deepEqual(seenInHook[0], page)
  assert.equal(calls[0]?.[0], "mount")

  json.remove()
  hostElement.remove()
})
