// The Vue suite builds the package first and runs `node:test` against `dist/`
// so `pnpm -r test` works without another package's build. `--test-force-exit`
// is required because TanStack Query keeps 5-minute `gcTime` timers alive after
// a test unmounts, which would otherwise hold the test-runner process open.
import { Window } from "happy-dom"

const window = new Window({ url: "http://localhost/" })
const document = window.document
document.body.innerHTML = ""

Object.assign(globalThis, {
  window,
  document,
  HTMLElement: window.HTMLElement,
  HTMLAnchorElement: window.HTMLAnchorElement,
  HTMLButtonElement: window.HTMLButtonElement,
  HTMLFormElement: window.HTMLFormElement,
  HTMLInputElement: window.HTMLInputElement,
  Element: window.Element,
  Node: window.Node,
  Text: window.Text,
  Comment: window.Comment,
  DocumentFragment: window.DocumentFragment,
  ShadowRoot: window.ShadowRoot,
  SVGElement: window.SVGElement,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  MouseEvent: window.MouseEvent,
  PointerEvent: window.PointerEvent,
  KeyboardEvent: window.KeyboardEvent,
  SubmitEvent: window.SubmitEvent,
  FormData: window.FormData,
  DOMException: window.DOMException,
  CSSStyleSheet: window.CSSStyleSheet,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})

Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true })
Object.defineProperty(globalThis, "location", { value: window.location, configurable: true })

export { document, window }
