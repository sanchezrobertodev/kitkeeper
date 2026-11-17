// Per-viewer UI preferences. Storage can be unavailable, so every access is guarded.

import type { LanguagePref } from "../i18n";
import type { Kind, Source, Status } from "../types";

export type Theme = "system" | "light" | "dark";
/** Colour themes in index.css; each has a light and a dark variant. */
export const palettes = ["workbench", "graphite", "indigo", "rose", "contrast"] as const;
export type Palette = (typeof palettes)[number];
/** Accent colours in index.css that replace a palette's own accent; "theme" keeps it. */
export const accents = ["theme", "violet", "blue", "teal", "green", "pink"] as const;
export type Accent = (typeof accents)[number];
/** The accent a palette already has, left out of its picker. Workbench differs from Violet only in the button gradient. */
export const ownAccent: Partial<Record<Palette, Accent>> = { workbench: "violet" };
export type SortKey = "name" | "kind" | "source" | "version" | "status" | "updated" | "cost" | "uses";
/** "Show only" filters that cut across type and source. */
export type Flag = "mod" | "issues" | "unused" | "hooks";

export interface Filters {
  kinds: Kind[];
  statuses: Status[];
  sources: Source[];
  origins: string[];
  enabled: "all" | "enabled" | "disabled";
  flags: Flag[];
}

export interface Prefs {
  theme: Theme;
  palette: Palette;
  accent: Accent;
  language: LanguagePref;
  sort: { key: SortKey; desc: boolean };
  filters: Filters;
}

export const emptyFilters: Filters = { kinds: [], statuses: [], sources: [], origins: [], enabled: "all", flags: [] };

const defaults: Prefs = {
  theme: "system",
  palette: "workbench",
  accent: "theme",
  language: "system",
  sort: { key: "status", desc: false },
  filters: emptyFilters,
};

const KEY = "skillshelf.prefs.v1";

export function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaults;
    const p = JSON.parse(raw) as Partial<Prefs>;
    return { ...defaults, ...p, filters: { ...emptyFilters, ...p.filters } };
  } catch {
    return defaults;
  }
}

export function savePrefs(p: Prefs) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch {
    /* storage unavailable: preferences just won't persist */
  }
}

const media = typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)") : null;

/** The `data-accent` for a palette, or undefined to keep its own accent: High contrast always, and the accent it already has. */
export const accentAttr = (palette: Palette, accent: Accent) =>
  palette === "contrast" || accent === "theme" || accent === ownAccent[palette] ? undefined : accent;

export function applyTheme(theme: Theme, palette: Palette, accent: Accent) {
  const dark = theme === "dark" || (theme === "system" && !!media?.matches);
  const root = document.documentElement.dataset;
  root.theme = dark ? "dark" : "light";
  root.palette = palette;
  const a = accentAttr(palette, accent);
  if (a) root.accent = a;
  else delete root.accent;
}

export function onSystemThemeChange(cb: () => void) {
  media?.addEventListener("change", cb);
  return () => media?.removeEventListener("change", cb);
}
