// The Angular suite runs on `node:test` against `dist/` with happy-dom as the
// browser global. `@angular/compiler` is loaded *before* any Angular package
// is evaluated: partially compiled libraries such as `@angular/common` fall
// back to JIT in a raw Node import, and test-only components (defined with
// the `Component()` decorator function instead of decorator syntax) always
// compile through JIT. happy-dom is installed before the package imports
// because `@angular/platform-browser` captures DOM globals at application
// creation time. `--test-force-exit` is required because TanStack Query keeps
// `gcTime` timers alive after a test unmounts.
import { Window } from "happy-dom"
import "@angular/compiler"

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
  HTMLAreaElement: window.HTMLAreaElement,
  Element: window.Element,
  Document: window.Document,
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
  BeforeUnloadEvent: window.BeforeUnloadEvent,
  FormData: window.FormData,
  DOMException: window.DOMException,
  MutationObserver: window.MutationObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})

Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true })
Object.defineProperty(globalThis, "location", { value: window.location, configurable: true })

export { document, window }
