import { getTheme } from "@kolektiv/themes"

const SITE_THEME_IDS = [
  "catppuccin-latte",
  "catppuccin-frappe",
  "catppuccin-macchiato",
  "catppuccin-mocha",
] as const

export type SiteTheme = (typeof SITE_THEME_IDS)[number]

export const SITE_THEMES = SITE_THEME_IDS.map((id) => {
  const theme = getTheme(id)
  return {
    id,
    label: theme?.label.replace("Catppuccin ", "") ?? id,
    scheme: theme?.scheme ?? "dark",
    swatch: theme?.colors["base-100"] ?? "#1e1e2e",
  }
})

export const CODE_THEMES = [
  { id: "follow", label: "Follow site theme" },
  { id: "latte", label: "Latte" },
  { id: "frappe", label: "Frappé" },
  { id: "macchiato", label: "Macchiato" },
  { id: "mocha", label: "Mocha" },
] as const

export type CodeTheme = (typeof CODE_THEMES)[number]["id"]

// Astro's <Code themes> wants Shiki preset names as literals.
export const SHIKI_THEMES = {
  mocha: "catppuccin-mocha",
  macchiato: "catppuccin-macchiato",
  frappe: "catppuccin-frappe",
  latte: "catppuccin-latte",
} as const

export const DEFAULT_SITE_THEME: SiteTheme = "catppuccin-mocha"
export const DEFAULT_CODE_THEME: CodeTheme = "follow"

export function isSiteTheme(value: string | null): value is SiteTheme {
  return SITE_THEMES.some((theme) => theme.id === value)
}

export function isCodeTheme(value: string | null): value is CodeTheme {
  return CODE_THEMES.some((theme) => theme.id === value)
}

export function migrateSiteTheme(value: string | null): SiteTheme {
  if (value === "keel-light") return "catppuccin-latte"
  if (value === "keel-dark") return "catppuccin-mocha"
  return isSiteTheme(value) ? value : DEFAULT_SITE_THEME
}
