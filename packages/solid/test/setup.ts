// The Solid suite builds the package first and runs `node:test` against
// `dist/`. `--conditions=browser` is required so Node resolves `solid-js` /
// `solid-js/web` to their client builds instead of the server builds.
// Solid commits signal writes synchronously, so the suite needs no scheduler
// flush helper. `--test-force-exit` is still required because TanStack Query
// keeps 5-minute `gcTime` timers alive after a test unmounts.
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
  HTMLHeadElement: window.HTMLHeadElement,
  HTMLTemplateElement: window.HTMLTemplateElement,
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
