import { BrushCleaning, Compass, Download, LayoutDashboard, LibraryBig, Monitor, Moon, Server, Settings, Sun } from "lucide-react";
import type { ReactNode } from "react";
import { type TKey, useT } from "../i18n";
import { cx } from "../lib/cx";
import { relativeTime } from "../lib/format";
import { isUnused } from "../lib/insights";
import type { Theme } from "../lib/prefs";
import { type Screen, updatable, useStore } from "../store";
import { AppUpdateRailButton } from "./AppUpdate";

const nextTheme: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const themeIcon = { system: Monitor, light: Sun, dark: Moon };

const rowCls = "flex h-8 w-full items-center gap-2.5 rounded-md px-2 text-left text-[13px] font-medium transition-colors duration-150";
const idleCls = "text-muted hover:bg-surface-hover hover:text-fg";
const pillCls = { warn: "border-warn/35 bg-warn/12 text-warn", danger: "border-danger/35 bg-danger/10 text-danger" };

function NavItem({
  icon: Icon,
  label,
  count,
  tone,
  on,
  onClick,
}: {
  icon: typeof LibraryBig;
  label: string;
  count?: number | null;
  tone?: keyof typeof pillCls;
  on: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" aria-current={on ? "page" : undefined} onClick={onClick} className={cx(rowCls, on ? "bg-nav-active text-nav-active-fg" : idleCls)}>
      <Icon aria-hidden className="size-4 shrink-0" />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && (
        <span className={cx("font-mono text-xs tabular-nums", tone ? cx("rounded-full border px-1.5", pillCls[tone]) : "text-muted")}>{count}</span>
      )}
    </button>
  );
}

function Group({ label, children }: { label?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      {label && <h2 className="px-2 pt-4 pb-1.5 text-xs font-medium text-muted">{label}</h2>}
      {children}
    </div>
  );
}

/** The sidebar: sections with their counts, then the check status, app version, mode and Settings. */
export function Rail() {
  const t = useT();
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const browse = useStore((s) => s.browse);
  const filters = useStore((s) => s.filters);
  const query = useStore((s) => s.query);
  const items = useStore((s) => s.items);
  const usage = useStore((s) => s.usage);
  const mcp = useStore((s) => s.mcp);
  const catalog = useStore((s) => s.catalog);
  const busy = useStore((s) => s.busy);
  const checkedAt = useStore((s) => s.checkedAt);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const ThemeIcon = themeIcon[theme];

  // "Updates" is the Library filtered to pending updates, so it is the current section only while that is all that's filtered.
  const onlyUpdates =
    !query &&
    filters.statuses.length === 1 &&
    filters.statuses[0] === "updateAvailable" &&
    !filters.kinds.length &&
    !filters.sources.length &&
    !filters.origins.length &&
    !filters.flags.length &&
    filters.enabled === "all";
  const current = screen === "library" && onlyUpdates ? "updates" : screen;
  const installed = new Set(items.filter((i) => i.kind === "plugin").map((i) => `${i.name}@${i.origin}`));
  const problems = mcp?.servers.filter((s) => s.state !== "connected").length;

  const nav = (id: Screen, icon: typeof LibraryBig, label: TKey, count?: number | null, tone?: keyof typeof pillCls) => (
    <NavItem icon={icon} label={t(label)} count={count} tone={tone} on={current === id} onClick={() => setScreen(id)} />
  );
  const status =
    busy === "scanning"
      ? t("toolbar.scanning")
      : busy === "checking"
        ? t("toolbar.checking")
        : checkedAt
          ? t("toolbar.checked", { time: relativeTime(checkedAt) })
          : t("toolbar.notChecked");

  return (
    <nav aria-label={t("rail.sections")} className="flex w-56 shrink-0 flex-col border-r border-border bg-surface px-3 py-4">
      <div className="mb-4 flex items-center gap-2.5 px-2">
        {/* The Drop socket mark, one colour (design-system/skillshelf/icon-drop-socket-tray.svg). */}
        <svg aria-hidden viewBox="0 0 32 32" className="size-6 text-accent">
          <mask id="rail-logo" maskUnits="userSpaceOnUse" x="0" y="0" width="32" height="32">
            <polygon points="16,9.8 28.6,17.1 16,24.4 3.4,17.1" fill="#fff" />
            <polygon points="3.4,17.1 16,24.4 16,30.5 3.4,23.2" fill="#fff" />
            <polygon points="28.6,17.1 16,24.4 16,30.5 28.6,23.2" fill="#fff" />
            <polygon points="16,13.3 22.7,17.1 16,21 9.3,17.1" fill="#000" />
            <polygon points="16,1.5 22,4.9 16,8.4 10,4.9" fill="#fff" />
            <polygon points="10,4.9 16,8.4 16,15.3 10,11.8" fill="#fff" />
            <polygon points="22,4.9 16,8.4 16,15.3 22,11.8" fill="#fff" />
            <g fill="none" stroke="#000" strokeWidth="2" strokeLinejoin="round">
              <polyline points="16,1.5 22,4.9 22,11.8 16,15.3 10,11.8 10,4.9 16,1.5" />
              <polyline points="10,4.9 16,8.4 22,4.9" />
              <polyline points="16,8.4 16,15.3" />
            </g>
          </mask>
          <rect width="32" height="32" fill="currentColor" mask="url(#rail-logo)" />
        </svg>
        <span className="text-[15px] font-semibold tracking-tight">Kitkeeper</span>
      </div>

      <Group>
        {nav("overview", LayoutDashboard, "rail.overview")}
        {nav("library", LibraryBig, "rail.library", items.length || null)}
        {nav("discover", Compass, "rail.discover", catalog && catalog.filter((e) => !installed.has(e.id)).length)}
      </Group>
      <Group label={t("rail.maintenance")}>
        <NavItem
          icon={Download}
          label={t("overview.updates")}
          count={updatable(items).length || null}
          tone="warn"
          on={current === "updates"}
          onClick={() => browse({ statuses: ["updateAvailable"] })}
        />
        {nav("cleanup", BrushCleaning, "rail.cleanup", usage && (items.filter((i) => isUnused(i, usage)).length || null))}
        {nav("mcp", Server, "toolbar.mcpServers", problems || null, "danger")}
      </Group>

      <div className="mt-auto flex flex-col gap-0.5 border-t border-border pt-3">
        <p className="flex items-center gap-2 px-2 pb-1 text-xs text-muted" aria-live="polite">
          <span aria-hidden className={cx("size-2 shrink-0 rounded-full", busy === "idle" ? (checkedAt ? "bg-accent" : "bg-border-strong") : "animate-pulse bg-accent")} />
          <span className="truncate">{status}</span>
        </p>
        <AppUpdateRailButton className={rowCls} />
        <button
          type="button"
          className={cx(rowCls, idleCls)}
          aria-label={t("rail.themeToggle", { current: t(`mode.${theme}`), next: t(`mode.${nextTheme[theme]}`) })}
          onClick={() => setTheme(nextTheme[theme])}
        >
          <ThemeIcon aria-hidden className="size-4 shrink-0" />
          {t(`mode.${theme}`)}
        </button>
        {nav("settings", Settings, "rail.settings")}
      </div>
    </nav>
  );
}
