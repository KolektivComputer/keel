/**
 * DOM helpers for Keel's content-authoring components (copy button, framework
 * selects, file tabs, block-level language toggles). These are content
 * behaviours, not chrome: the shared package owns the global preference
 * engine, and `KeelBehavior.astro` reconciles the two.
 */

/** Read the visible code from a snippet figure/deck for the copy button. */
export function copyFromFigure(root: HTMLElement): string {
  const filePanels = [...root.querySelectorAll<HTMLElement>("[data-file-panel]")]
  const file =
    filePanels.find((panel) => {
      const group = panel.closest<HTMLElement>("[data-framework-panel]")
      if (group && getComputedStyle(group).display === "none") return false
      return !panel.classList.contains("hidden") && getComputedStyle(panel).display !== "none"
    }) ?? root
  const langPanels = [...file.querySelectorAll<HTMLElement>("[data-lang-panel]")]
  const visible = langPanels.find((panel) => getComputedStyle(panel).display !== "none")
  const pre = (visible ?? file).querySelector("pre")
  return (pre?.innerText ?? "").replace(/\n$/, "")
}

/** Reflect the active file tab for a deck. */
export function syncFileButtons(deck: HTMLElement): void {
  const index = deck.dataset.file ?? "0"
  deck.querySelectorAll<HTMLButtonElement>("[data-file-btn]").forEach((btn) => {
    const on = btn.dataset.fileBtn === index
    btn.classList.toggle("btn-active", on)
    btn.setAttribute("aria-selected", String(on))
  })
}

/**
 * Point every local framework picker (snippet decks, install blocks) at the
 * preferred framework when it offers it, falling back to Svelte. Snippets that
 * offer neither keep their current selection.
 */
export function syncLocalFrameworks(frontend: string, root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>("[data-local-framework]").forEach((select) => {
    const options = [...select.options].map((option) => option.value)
    const target = options.includes(frontend)
      ? frontend
      : options.includes("svelte")
        ? "svelte"
        : undefined
    if (!target || select.value === target) return
    select.value = target
    const code = select.closest<HTMLElement>(".keel-deck, .keel-code")
    if (!code) return
    code.dataset.framework = target
    syncFileButtons(code)
  })
}

/** Reflect the active language on block-scoped TS/JS toggles. */
export function syncBlockLangButtons(root: ParentNode = document): void {
  const globalLang = document.documentElement.dataset.lang || "ts"
  root.querySelectorAll<HTMLButtonElement>("[data-lang-btn]").forEach((el) => {
    const block = el.closest<HTMLElement>(".keel-code")
    const current = block?.dataset.lang || globalLang
    const active = el.dataset.langBtn === current
    el.classList.toggle("btn-active", active)
    el.setAttribute("aria-pressed", String(active))
  })
}
