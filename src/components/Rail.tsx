import { BrushCleaning, LayoutDashboard, LibraryBig, Monitor, Moon, Server, Settings, Sun } from "lucide-react";
import { type TKey, useT } from "../i18n";
import { cx } from "../lib/cx";
import type { Theme } from "../lib/prefs";
import { type Screen, useStore } from "../store";

const screens: { id: Screen; label: TKey; icon: typeof LibraryBig }[] = [
  { id: "overview", label: "rail.overview", icon: LayoutDashboard },
  { id: "library", label: "rail.library", icon: LibraryBig },
  { id: "cleanup", label: "rail.cleanup", icon: BrushCleaning },
  { id: "mcp", label: "rail.mcp", icon: Server },
];

const nextTheme: Record<Theme, Theme> = { system: "light", light: "dark", dark: "system" };
const themeIcon = { system: Monitor, light: Sun, dark: Moon };

const itemCls =
  "flex w-16 flex-col items-center gap-1 rounded-[10px] px-1 py-2 text-[11px] font-medium transition-colors duration-150";
const idleCls = "text-muted hover:bg-surface-hover hover:text-fg";

export function Rail() {
  const screen = useStore((s) => s.screen);
  const setScreen = useStore((s) => s.setScreen);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const t = useT();
  const ThemeIcon = themeIcon[theme];
  const nav = (id: Screen) => cx(itemCls, screen === id ? "bg-nav-active text-nav-active-fg" : idleCls);

  return (
    <nav aria-label={t("rail.sections")} className="flex w-20 shrink-0 flex-col items-center gap-1.5 border-r border-border bg-surface py-3">
      {/* The Drop socket mark, one colour (design-system/skillshelf/icon-drop-socket-tray.svg). */}
      <svg aria-label="Kitkeeper" role="img" viewBox="0 0 32 32" className="mb-3 size-7 text-accent">
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
      {screens.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          aria-current={screen === id ? "page" : undefined}
          onClick={() => setScreen(id)}
          className={nav(id)}
        >
          <Icon aria-hidden className="size-5" />
          {t(label)}
        </button>
      ))}
      <div className="mt-auto flex flex-col items-center gap-1.5">
        <button
          type="button"
          className={cx(itemCls, idleCls)}
          aria-label={t("rail.themeToggle", { current: t(`mode.${theme}`), next: t(`mode.${nextTheme[theme]}`) })}
          onClick={() => setTheme(nextTheme[theme])}
        >
          <ThemeIcon aria-hidden className="size-5" />
          {t(`mode.${theme}`)}
        </button>
        <button
          type="button"
          aria-current={screen === "settings" ? "page" : undefined}
          className={nav("settings")}
          onClick={() => setScreen("settings")}
        >
          <Settings aria-hidden className="size-5" />
          {t("rail.settings")}
        </button>
      </div>
    </nav>
  );
}
