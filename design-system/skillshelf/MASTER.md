# Design System Master File

> **LOGIC:** When building a specific page, first check `design-system/skillshelf/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file. If not, follow the rules below.

---

**Project:** Kitkeeper
**Direction:** Workbench "Professional" (chosen 2026-11-24 as mockup C; replaces the 2026-11-01 "Aurora" glow-and-glass look, which restyled the 2026-10-31 teal Workbench)
**Source:** ui-ux-pro-max: *Minimalism & Swiss Style* and data-dense dashboard practice (labelled navigation, one primary action per screen, KPI cards, ranked bars, single-line tables, an inspector panel), Geist type. Every text pair passes WCAG AA.
**Dials:** Variance 2 (calm, conventional) · Motion 2 (subtle) · Density 7 (dense list, roomy chrome)

---

## Principles

- **Flat and quiet.** Opaque surfaces, hairline borders and a 1px shadow. No glow, gradient, glass or blur on any palette.
- **One primary action per screen.** The top bar holds at most one filled button. Cards act through quiet text links with an arrow (`LinkButton` in `Overview.tsx`); the details panel has one filled button and puts the rest in a "…" menu.
- **Blue is for action and place.** It marks the current sidebar item, links, switches, focus and the filled primary button.
- **Orange means "update".** Use it only for update status, update buttons, update counts and update risk flags, so a pending update is the one warm thing on screen. Risk flags on a plugin you haven't installed yet (Discover) use the info tint.
- **Status is never colour alone.** Every chip has an icon and text. Every chart has a text alternative (`role="img"` plus `aria-label`).
- **Components use semantic tokens only** (`bg-surface`, `text-muted`, `bg-warn`…), never raw hex.

## Themes

Five palettes, each with a light and a dark block in `src/index.css` that defines every token below. The table shows Workbench, the default.

| Palette | Accent | Notes |
|---|---|---|
| Workbench | blue (`#2453D6` / `#7EA2FF`) | Default. Cool grey canvas, white cards |
| Graphite | near-black / near-white | Monochrome, so orange updates are the only colour |
| Indigo | blue indigo (`#3B5BDB` / `#91A7FF`) | Cool slate surfaces |
| Rose | rose | Updates use amber so they stay distinct from the accent |
| High contrast | dark blue / sky | 7:1 text, hard borders instead of shadows, inverted active sidebar item |

**Accent colours.** Settings → Appearance can replace a palette's accent with violet, blue, teal, green or pink. Each is a light and a dark `[data-accent]` block in `src/index.css` that sets `--accent` (+`-hover`, `-fg`), `--ring` and `--nav-active` (+`-fg`). High contrast always keeps its own. Workbench's picker leaves out Blue, its own accent (`ownAccent` in `prefs.ts`). There is no orange, amber or red accent, because orange means "update" and red means danger.

`node scripts/contrast.mjs` (part of `make check` and CI) checks every text pair of every theme and every accent on every other palette, including chips on their own tints.

## Tokens (`src/index.css`)

Workbench values:

| Token | Light | Dark | Use |
|---|---|---|---|
| `--bg` | `#F6F7F9` | `#0E1116` | Window canvas |
| `--surface` | `#FFFFFF` | `#161A21` | Cards, sidebar, top bar, dialogs |
| `--surface-2` | `#F1F3F6` | `#1C212A` | Table header, wells, code, skeletons |
| `--surface-hover` | `#E9EDF2` | `#232934` | Hover fill |
| `--border` / `--border-strong` | `#E1E4EA` / `#CDD2DB` | `#2A303B` / `#3B4351` | Dividers / control outlines |
| `--card-border` | `#E1E4EA` | `#2A303B` | Card edge |
| `--fg` | `#101828` | `#EEF1F5` | Text |
| `--muted` | `#4B5565` | `#A3ACBA` | Secondary text |
| `--accent` (+`-hover`, `-fg`) | `#2453D6` / `#1D44B8` / `#FFFFFF` | `#7EA2FF` / `#A3BDFF` / `#0A1633` | Current item, links, focus, primary |
| `--warn` (+`-hover`, `-fg`) | `#B43C0A` / `#9A330A` / `#FFFFFF` | `#FB923C` / `#FDBA74` / `#1C0A02` | Updates only |
| `--danger` | `#B42318` | `#F87171` | Destructive, failures |
| `--info` | `#3B5B7A` | `#9FB6CF` | Managed, neutral info |
| `--ring` | `#2453D6` | `#A3BDFF` | Focus ring |
| `--nav-active` / `-fg` | `#EAF0FE` / `#1D44B8` | `#1A2A4F` / `#C4D4FF` | Current sidebar item, current table row, active filter |
| `--card-shadow` | `0 1px 2px` ink 5% | `0 1px 2px` black 40% | Cards |
| `--scrim` | ink 40% | near-black 70% | Behind dialogs |

## Type

- **UI:** Geist, 14px base, 13px in dense rows and controls, 11px uppercase for section labels inside the details panel and dialogs (tracking 0.06em). Table headers and filter labels are sentence case, 12px medium.
- **Code, versions, ids, paths, counts in the sidebar, token counts:** JetBrains Mono, 11–12px, tabular figures.
- Headings are semibold. Page title 16px in the top bar; KPI values 26px.

## Shape and spacing

- Radius: cards and controls 8px (`rounded-lg`), dialogs 12px (`rounded-xl`), chips and count pills fully rounded.
- Page gutter 20px. Gaps between cards 16px. Card padding 16px; panels have a 48px header row with a bottom border.

## Layout

```
┌──────────────┬───────────────────────────────────────────────────────┐
│ ◆ Kitkeeper  │ Title  subtitle          [search]  [Check now] [■ 1°] │ top bar, 56px, border-b
│              ├───────────────────────────────────────────────────────┤
│ Overview     │ (banners)                                             │
│ Library  160 │ [All|Plugins|Skills] [Status ▾] [Source ▾] [More ▾]   │ Library filter bar
│ Discover  12 │ ┌──────────── table card ─────────┐ ┌─ inspector ───┐ │
│              │ │ header row (surface-2)          │ │ name, about   │ │
│ MAINTENANCE  │ │ rows, 44px, one line            │ │ [■ Update][…] │ │
│ Updates   (8)│ │                                 │ │ facts         │ │
│ Clean Up   3 │ │                                 │ │ what changed… │ │
│ MCP        (1)│ └─────────────────────────────────┘ └───────────────┘ │
│──────────────│                                                       │
│ • Checked    │ ┌──────────── queue card (when jobs exist) ─────────┐ │
│ version/☾/⚙  │ └───────────────────────────────────────────────────┘ │
└──────────────┴───────────────────────────────────────────────────────┘
```

- **Sidebar** (`Rail.tsx`), 224px, surface with a right border: the logo and name, then labelled 32px items with an optional count on the right. Plain counts are muted mono text; counts that need action are pills (orange for updates, red for MCP problems). A "Maintenance" group label sits above Updates, Clean Up and MCP Servers. Updates opens the Library filtered to pending updates and shows as current while that is the only filter. The bottom block (above a border) has the check status with a dot (blue, pulsing while busy), the app version button, the theme toggle and Settings.
- **Top bar** (`Toolbar.tsx`), 56px, surface with a bottom border: the page title (Overview adds a muted subtitle with the item count), the search, Check now (secondary) and Review updates, which is the screen's one primary (`update` variant) on Overview and on the Library when the details panel is closed, and secondary otherwise.
- **Overview:** a row of four KPI cards (Updates, Context per session, Uses with a sparkline, Unused plugins; two per row below 760px of content width), then two panels (Context per session and Most used as ranked bars, 3:2 from 860px), then an Issues panel: a divided list of rows, each a labelled chip, what is wrong and one secondary button. Unchecked MCP servers show as an offer to check, not as an issue.
- **Library:** a filter bar (a segmented All / Plugins / Skills control with counts; Status, Source and More filters menus whose buttons show how many choices are on; a Clear link), then the table card beside the details panel. Rows are one line, 44px; the description is the name's tooltip; the current row uses the nav-active fill; a row's only inline control is the on/off switch, and the rest is in the row menu (right-click or Shift F10). Name, Status and the switch always show. The Columns button at the end of the header picks the rest (Type, Source, Version, Cost, Uses, Last used, Updated, Installed; default Type, Version, Uses, Last used, Updated). Picked columns that don't fit drop in a fixed order (`priority` in `ItemList.tsx`) and the menu marks them "No room".
- **Details panel** (`DetailPanel.tsx`), a 344px inspector: the icon, name and close; the description (three lines, Show more); one filled button (Update to x, else Reinstall), the on/off button and a "…" menu with the row actions (Open folder, Open repo, Uninstall…). Then the facts (Type, Source, Marketplace, Scope, Status, Version with "→ latest" in orange, Installed, Updated…), then what changed, notes, issues, cost, usage, location, readme and contents. Below 1240px wide it overlays the table instead of sitting beside it.
- **Discover:** one header card (the count, a hint, and Marketplace and Category selects), then one list card. Each row has the name (opens the review), marketplace · category, a two-line description, the token estimate and risk chips, and a secondary Install button that also opens the review. The review dialog lists what runs without asking, the context cost and the contents; the Install button in it is `primary`. The top bar search filters Discover while it is open.
- **Settings:** a 176px section nav (General, Appearance, Updates, Project folders, About; the current one uses the nav-active fill) beside one section at a time, as a 15px title over one card of rows.
- Minimum window 960×600.

## Components

- **Buttons:** `primary` (solid accent), `update` (orange, for update actions only), `secondary` (surface with an outline), `ghost`, `danger` (outline). Heights 36 and 32.
- **Menus** (`Menu` in `ContextMenu.tsx`): a surface card with a border and shadow, at most 70% of the window tall (it scrolls), arrow-key navigation, Escape closes. Filter menus use checkbox or radio rows with a tick and a count, and stay open while you choose.
- **Status chip:** icon + label, tinted background, 1px tinted border.
- **Charts:** inline SVG sparklines and bars in `--accent`. Each has a text alternative such as "41 uses in the last 30 days". Ranked bars (`RankedBars` in `Overview.tsx`): one series, so no legend; largest first; 10px bars, square at the baseline and 4px-rounded at the tip; the value at the tip in muted text, never the accent; hover or focus shows a small card with the value first and the detail after, which is also the row's description. A name that appears twice in one chart (a plugin and a skill) gets its type after it in muted text. A row opens its item.
- **Dialogs:** a card on the scrim. Focus is trapped and returns to where it was. Escape closes.

## Motion

100–200ms colour and opacity transitions only. Nothing moves on hover. `prefers-reduced-motion` turns transitions off.

## Anti-patterns

- Orange anywhere that isn't about an update.
- More than one filled button in the top bar or a card.
- Colour-only status, or icon-only buttons without `aria-label`.
- Raw hex in components.
- Glow, gradients, glass or blur.
- Shadows in dark mode instead of borders.
