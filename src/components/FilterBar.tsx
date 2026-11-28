import { Check, ChevronDown, SlidersHorizontal } from "lucide-react";
import { useCallback, useDeferredValue, useMemo, useState, type ReactNode } from "react";
import { useT } from "../i18n";
import { cx } from "../lib/cx";
import { countBy, flagTest, matches, type Facet } from "../lib/filter";
import { sourceHelp, sourceLabel, statusLabel, statusOrder } from "../lib/format";
import type { Filters, Flag } from "../lib/prefs";
import { useStore } from "../store";
import type { Kind, Source, Status } from "../types";
import { Menu } from "./ContextMenu";

interface Option<T extends string> {
  value: T;
  label: string;
  count: number;
  hint?: string;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Heading({ children }: { children: ReactNode }) {
  return (
    <div role="presentation" className="px-2.5 pt-2 pb-1 text-xs font-medium text-muted">
      {children}
    </div>
  );
}

/** A ticked or radio row in a filter menu, with how many items it would show. Choosing keeps the menu open. */
function Choice({
  label,
  count,
  hint,
  on,
  radio,
  onClick,
}: {
  label: string;
  count?: number | null;
  hint?: string;
  on: boolean;
  radio?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role={radio ? "menuitemradio" : "menuitemcheckbox"}
      aria-checked={on}
      tabIndex={-1}
      title={hint}
      onClick={onClick}
      className="flex h-8 w-full min-w-56 items-center gap-2 rounded-md px-2.5 text-left text-[13px] transition-colors duration-100 hover:bg-surface-hover focus-visible:bg-surface-hover focus-visible:outline-none"
    >
      <Check aria-hidden className={cx("size-4 shrink-0 text-accent", !on && "invisible")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {count != null && <span className="pl-3 font-mono text-xs text-muted tabular-nums">{count}</span>}
    </button>
  );
}

function Choices<T extends string>({ options, selected, onToggle }: { options: Option<T>[]; selected: T[]; onToggle: (v: T) => void }) {
  return options.map((o) => (
    <Choice key={o.value} label={o.label} count={o.count} hint={o.hint} on={selected.includes(o.value)} onClick={() => onToggle(o.value)} />
  ));
}

/** A filter button that opens its menu below it; it shows how many of its choices are on. */
function FilterMenu({ label, icon: Icon, active, children }: { label: string; icon?: typeof Check; active: number; children: ReactNode }) {
  const [at, setAt] = useState<{ x: number; y: number } | null>(null);
  const close = useCallback(() => setAt(null), []);
  return (
    <>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={!!at}
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setAt(at ? null : { x: r.left, y: r.bottom + 4 });
        }}
        className={cx(
          "inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-2.5 text-[13px] font-medium whitespace-nowrap transition-colors duration-150",
          active ? "border-accent/50 bg-nav-active text-nav-active-fg" : "border-border-strong bg-surface text-muted hover:bg-surface-hover hover:text-fg",
        )}
      >
        {Icon && <Icon aria-hidden className="size-3.5" />}
        {label}
        {active > 0 && <span className="font-mono text-xs tabular-nums">{active}</span>}
        <ChevronDown aria-hidden className="size-3.5" />
      </button>
      {at && (
        <Menu x={at.x} y={at.y} label={label} onClose={close}>
          {children}
        </Menu>
      )}
    </>
  );
}

/** The Library's filters in one row: type as a segmented control, the rest in Status, Source and More menus. */
export function FilterBar() {
  const t = useT();
  const items = useStore((s) => s.items);
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const clearFilters = useStore((s) => s.clearFilters);
  const query = useDeferredValue(useStore((s) => s.query));
  const usage = useStore((s) => s.usage);

  const facets = useMemo(() => {
    const pool = (f: Facet) => items.filter((i) => matches(i, filters, query, usage, f));
    const kindPool = pool("kinds");
    const kinds = countBy(kindPool, (i) => i.kind);
    const statuses = countBy(pool("statuses"), (i) => i.status);
    const sources = countBy(pool("sources"), (i) => i.source);
    const origins = countBy(pool("origins"), (i) => i.origin);
    const allOrigins = [...new Set(items.map((i) => i.origin).filter((o): o is string => !!o))];
    const enabledPool = pool("enabled");
    const flagPool = pool("flags");
    const flags = new Map((Object.keys(flagTest) as Flag[]).map((k) => [k, flagPool.filter((i) => flagTest[k](i, usage)).length]));
    return { all: kindPool.length, kinds, statuses, sources, origins, allOrigins, enabledPool, flags };
  }, [items, filters, query, usage]);

  const presentStatuses = [...new Set(items.map((i) => i.status))].sort((a, b) => statusOrder[a] - statusOrder[b]);
  const statusOpts: Option<Status>[] = presentStatuses.map((s) => ({ value: s, label: statusLabel[s], count: facets.statuses.get(s) ?? 0 }));
  const sourceOpts: Option<Source>[] = (["marketplace", "synced", "skillsCli", "local", "project"] as Source[])
    .filter((s) => items.some((i) => i.source === s))
    .map((s) => ({ value: s, label: sourceLabel[s], count: facets.sources.get(s) ?? 0, hint: sourceHelp[s] }));
  const originOpts: Option<string>[] = facets.allOrigins
    .map((o) => ({ value: o, label: o, count: facets.origins.get(o) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  const flagOpts: Option<Flag>[] = (
    [
      ["unused", t("filters.unused"), t("filters.unusedHint")],
      ["issues", t("filters.issues"), t("filters.issuesHint")],
      ["hooks", t("filters.hooks"), t("filters.hooksHint")],
      ["mod", t("filters.mods"), t("filters.modsHint")],
    ] as const
  )
    .filter(([k]) => k !== "unused" || usage)
    .map(([value, label, hint]) => ({ value, label, hint, count: facets.flags.get(value) ?? 0 }));

  const set = (f: Partial<Filters>) => setFilters(f);
  const kind: Kind | null = filters.kinds.length === 1 ? filters.kinds[0] : null;
  const more = filters.flags.length + (filters.enabled !== "all" ? 1 : 0);
  const active = filters.kinds.length + filters.statuses.length + filters.sources.length + filters.origins.length + more;
  const segments: [Kind | null, string, number][] = [
    [null, t("filters.all"), facets.all],
    ["plugin", t("filters.plugins"), facets.kinds.get("plugin") ?? 0],
    ["skill", t("filters.skills"), facets.kinds.get("skill") ?? 0],
  ];

  return (
    <div role="group" aria-label={t("filters.title")} className="mb-3 flex shrink-0 flex-wrap items-center gap-2">
      <div role="radiogroup" aria-label={t("filters.type")} className="inline-flex h-8 overflow-hidden rounded-lg border border-border-strong bg-surface">
        {segments.map(([v, label, n], i) => (
          <button
            key={label}
            type="button"
            role="radio"
            aria-checked={kind === v}
            onClick={() => set({ kinds: v ? [v] : [] })}
            className={cx(
              "inline-flex items-center gap-1.5 px-3 text-[13px] font-medium transition-colors duration-150",
              i > 0 && "border-l border-border-strong",
              kind === v ? "bg-surface-2 text-fg" : "text-muted hover:bg-surface-hover hover:text-fg",
            )}
          >
            {label}
            <span className="font-mono text-xs font-normal text-muted tabular-nums">{n}</span>
          </button>
        ))}
      </div>

      <FilterMenu label={t("filters.status")} active={filters.statuses.length}>
        <Choices options={statusOpts} selected={filters.statuses} onToggle={(v) => set({ statuses: toggle(filters.statuses, v) })} />
      </FilterMenu>
      <FilterMenu label={t("filters.source")} active={filters.sources.length + filters.origins.length}>
        <Heading>{t("filters.source")}</Heading>
        <Choices options={sourceOpts} selected={filters.sources} onToggle={(v) => set({ sources: toggle(filters.sources, v) })} />
        {originOpts.length > 0 && (
          <>
            <Heading>{t("filters.origin")}</Heading>
            <Choices options={originOpts} selected={filters.origins} onToggle={(v) => set({ origins: toggle(filters.origins, v) })} />
          </>
        )}
      </FilterMenu>
      <FilterMenu label={t("filters.more")} icon={SlidersHorizontal} active={more}>
        <Heading>{t("filters.showOnly")}</Heading>
        <Choices options={flagOpts} selected={filters.flags} onToggle={(v) => set({ flags: toggle(filters.flags, v) })} />
        <Heading>{t("filters.pluginState")}</Heading>
        {(
          [
            ["all", t("filters.all"), null],
            ["enabled", t("filters.on"), facets.enabledPool.filter((i) => i.enabled === true).length],
            ["disabled", t("filters.off"), facets.enabledPool.filter((i) => i.enabled === false).length],
          ] as const
        ).map(([v, label, n]) => (
          <Choice key={v} radio label={label} count={n} on={filters.enabled === v} onClick={() => set({ enabled: v })} />
        ))}
      </FilterMenu>

      {active > 0 && (
        <button type="button" onClick={clearFilters} className="rounded px-1.5 py-0.5 text-[13px] font-medium text-accent hover:underline">
          {t("filters.clear", { count: active })}
        </button>
      )}
    </div>
  );
}
