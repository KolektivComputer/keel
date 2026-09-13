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
  Element: window.Element,
  Node: window.Node,
  Event: window.Event,
  CustomEvent: window.CustomEvent,
  MouseEvent: window.MouseEvent,
  PointerEvent: window.PointerEvent,
  KeyboardEvent: window.KeyboardEvent,
  FormData: window.FormData,
  DOMException: window.DOMException,
  CSSStyleSheet: window.CSSStyleSheet,
  getComputedStyle: window.getComputedStyle.bind(window),
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
})

Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true })
Object.defineProperty(globalThis, "location", { value: window.location, configurable: true })

;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

export { document, window }
