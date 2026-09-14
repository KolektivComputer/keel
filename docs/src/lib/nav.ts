import type { NavSection } from "@kolektiv/common-docs-chrome"
import type { CollectionEntry } from "astro:content"
import { allDocs, CATEGORIES } from "./docs"

const ICONS: Record<string, string> = {
  overview: "M5 19V6.2c0-.3.2-.6.5-.7L12 3l6.5 2.5c.3.1.5.4.5.7V19l-7-2.5L5 19z",
  "getting-started": "M5 19V6.2c0-.3.2-.6.5-.7L12 3l6.5 2.5c.3.1.5.4.5.7V19l-7-2.5L5 19z",
  "core-concepts": "M12 3 4 7.5 12 12l8-4.5L12 3zm-8 9 8 4.5 8-4.5M4 16.5 12 21l8-4.5",
  advanced: "M13 3 4.5 14h7L11 21l8.5-11h-7L13 3z",
  implementing: "M4 7h16M4 12h10M4 17h7",
}

/** Build the package `NavSection[]` from sorted content-collection entries. */
export function navFromEntries(entries: CollectionEntry<"docs">[]): NavSection[] {
  const sections: NavSection[] = CATEGORIES.map((category) => ({
    label: category.label,
    icon: ICONS[category.id],
    items: entries
      .filter((entry) => entry.data.category === category.id)
      .map((entry) => ({
        label: entry.data.title,
        href: `/docs/${entry.id}`,
        description: entry.data.description,
      })),
  }))

  return [
    {
      label: "Overview",
      icon: ICONS.overview,
      items: [
        { label: "Home", href: "/", description: "Keel overview" },
        { label: "Documentation", href: "/docs", description: "All guides" },
      ],
    },
    ...sections,
  ]
}

export async function buildNav(): Promise<NavSection[]> {
  return navFromEntries(await allDocs())
}
