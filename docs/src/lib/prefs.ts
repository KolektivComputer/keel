import {
  DEFAULT_CODE_THEME,
  DEFAULT_SITE_THEME,
  isCodeTheme,
  migrateSiteTheme,
  type CodeTheme,
  type SiteTheme,
} from "./themes"

export const PREF_KEYS = {
  theme: "keel:theme",
  codeTheme: "keel:code-theme",
  lang: "keel:lang",
  frontend: "keel:frontend",
} as const

export type LangName = "ts" | "js"

export const FRAMEWORKS = [
  { id: "svelte", label: "Svelte", pkg: "@kolektiv/keel-svelte" },
  { id: "react", label: "React", pkg: "@kolektiv/keel-react" },
  { id: "vue", label: "Vue", pkg: "@kolektiv/keel-vue" },
  { id: "solid", label: "Solid", pkg: "@kolektiv/keel-solid" },
  { id: "preact", label: "Preact", pkg: "@kolektiv/keel-preact" },
  { id: "lit", label: "Lit", pkg: "@kolektiv/keel-lit" },
  { id: "angular", label: "Angular", pkg: "@kolektiv/keel-angular" },
] as const

export type FrameworkName = (typeof FRAMEWORKS)[number]["id"]

const FRAMEWORK_IDS = FRAMEWORKS.map((framework) => framework.id) as readonly FrameworkName[]

const FRAMEWORK_LABELS = Object.fromEntries(
  FRAMEWORKS.map((framework) => [framework.id, framework.label]),
) as Record<FrameworkName, string>

export type Prefs = {
  theme: SiteTheme
  codeTheme: CodeTheme
  lang: LangName
  frontend: FrameworkName
}

export const DEFAULTS: Prefs = {
  theme: DEFAULT_SITE_THEME,
  codeTheme: DEFAULT_CODE_THEME,
  lang: "ts",
  frontend: "svelte",
}

function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback
}

export function readPrefs(): Prefs {
  if (typeof localStorage === "undefined") return { ...DEFAULTS }
  const codeTheme = localStorage.getItem(PREF_KEYS.codeTheme)
  return {
    theme: migrateSiteTheme(localStorage.getItem(PREF_KEYS.theme)),
    codeTheme: isCodeTheme(codeTheme) ? codeTheme : DEFAULTS.codeTheme,
    lang: pick(localStorage.getItem(PREF_KEYS.lang), ["ts", "js"] as const, DEFAULTS.lang),
    frontend: pick(localStorage.getItem(PREF_KEYS.frontend), FRAMEWORK_IDS, DEFAULTS.frontend),
  }
}

export function applyPrefs(prefs: Partial<Prefs>): void {
  const next = { ...readPrefs(), ...prefs }
  const root = document.documentElement
  root.setAttribute("data-theme", next.theme)
  root.dataset.codeTheme = next.codeTheme
  root.dataset.lang = next.lang
  root.dataset.frontend = next.frontend
  root.dataset.backend = "ktor"
  localStorage.setItem(PREF_KEYS.theme, next.theme)
  localStorage.setItem(PREF_KEYS.codeTheme, next.codeTheme)
  localStorage.setItem(PREF_KEYS.lang, next.lang)
  localStorage.setItem(PREF_KEYS.frontend, next.frontend)
  document.dispatchEvent(new CustomEvent("keel:prefs", { detail: next }))
}

export function syncControls(root: ParentNode = document): void {
  const prefs = readPrefs()
  root.querySelectorAll<HTMLInputElement | HTMLSelectElement>("[data-pref]").forEach((el) => {
    const key = el.dataset.pref as keyof Prefs | undefined
    if (!key) return
    if (el.tagName === "SELECT") {
      const select = el as HTMLSelectElement
      select.value = prefs[key]
    } else {
      const input = el as HTMLInputElement
      input.checked = el.value === prefs[key]
    }
  })
  root.querySelectorAll<HTMLElement>("[data-theme-current]").forEach((el) => {
    const current = SITE_LABEL[prefs.theme]
    el.textContent = current
  })
  root.querySelectorAll<HTMLElement>("[data-code-theme-current]").forEach((el) => {
    el.textContent = prefs.codeTheme === "follow" ? "Follow" : CODE_LABEL[prefs.codeTheme]
  })
  root.querySelectorAll<HTMLElement>("[data-frontend-current]").forEach((el) => {
    el.textContent = FRAMEWORK_LABELS[prefs.frontend]
  })
  root.querySelectorAll<HTMLButtonElement>("[data-lang-btn]").forEach((el) => {
    const block = el.closest<HTMLElement>(".keel-code")
    const current = (block?.dataset.lang as LangName | undefined) || prefs.lang
    const active = el.dataset.langBtn === current
    el.classList.toggle("btn-active", active)
    el.setAttribute("aria-pressed", String(active))
  })
}

/**
 * Points every local framework picker (snippet decks, install blocks) at the
 * preferred frontend when it offers that framework, falling back to Svelte.
 * Snippets that offer neither keep their current selection.
 */
export function syncFrameworkTargets(frontend: FrameworkName, root: ParentNode = document): void {
  root.querySelectorAll<HTMLSelectElement>("[data-local-framework]").forEach((select) => {
    const options = [...select.options].map((option) => option.value)
    const target = options.includes(frontend)
      ? frontend
      : options.includes(DEFAULTS.frontend)
        ? DEFAULTS.frontend
        : undefined
    if (!target || select.value === target) return
    select.value = target
    const code = select.closest<HTMLElement>(".keel-deck, .keel-code")
    if (!code) return
    code.dataset.framework = target
    const index = code.dataset.file ?? "0"
    code.querySelectorAll<HTMLButtonElement>("[data-file-btn]").forEach((btn) => {
      const on = btn.dataset.fileBtn === index
      btn.classList.toggle("btn-active", on)
      btn.setAttribute("aria-selected", String(on))
    })
  })
}

const SITE_LABEL: Record<SiteTheme, string> = {
  "catppuccin-latte": "Latte",
  "catppuccin-frappe": "Frappé",
  "catppuccin-macchiato": "Macchiato",
  "catppuccin-mocha": "Mocha",
}

const CODE_LABEL: Record<Exclude<CodeTheme, "follow">, string> = {
  latte: "Latte",
  frappe: "Frappé",
  macchiato: "Macchiato",
  mocha: "Mocha",
}

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


