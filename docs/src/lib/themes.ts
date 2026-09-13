import { getTheme } from "@kolektiv/themes"
import { kolektivDark, kolektivLight } from "@kolektiv/themes/shiki"

const SITE_THEME_IDS = [
  "catppuccin-mocha",
  "catppuccin-macchiato",
  "catppuccin-frappe",
  "catppuccin-latte",
  "nord",
  "kolektiv-dark",
  "kolektiv-light",
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
  { id: "nord", label: "Nord" },
  { id: "kolektiv-light", label: "Kolektiv Light" },
  { id: "kolektiv-dark", label: "Kolektiv Dark" },
] as const

export type CodeTheme = (typeof CODE_THEMES)[number]["id"]

// Keys become `--shiki-<key>` variables; Astro accepts preset names or theme
// registrations (the Kolektiv themes come from @kolektiv/themes/shiki).
export const SHIKI_THEMES = {
  mocha: "catppuccin-mocha",
  macchiato: "catppuccin-macchiato",
  frappe: "catppuccin-frappe",
  latte: "catppuccin-latte",
  nord: "nord",
  "kolektiv-light": kolektivLight,
  "kolektiv-dark": kolektivDark,
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
