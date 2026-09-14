/**
 * DOM helpers for Keel's content-authoring components (copy button, file
 * tabs). These are content behaviours, not chrome: the shared package owns the
 * switcher/preference engine and panel visibility, so these helpers never
 * mutate the active language or framework.
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
