// The Lit suite builds the package first and runs `node:test` against
// `dist/`. happy-dom is installed as the browser global *before* `lit` is
// evaluated (test files import this module first), because LitElement and
// ContextEvent extend the global `HTMLElement` / `Event` at class definition
// time and `elements.ts` registers custom elements at module load. The test
// script passes `--conditions=browser` so `lit` resolves its browser builds
// instead of the `@lit/reactive-element/node` SSR shims. `--test-force-exit`
// is still required because TanStack Query keeps 5-minute `gcTime` timers
// alive after a test unmounts.
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
  HTMLSlotElement: window.HTMLSlotElement,
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
  CSSStyleSheet: window.CSSStyleSheet,
  customElements: window.customElements,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})

Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true })
Object.defineProperty(globalThis, "location", { value: window.location, configurable: true })

export { document, window }
