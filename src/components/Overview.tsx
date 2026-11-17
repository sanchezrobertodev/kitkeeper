import {
  BrushCleaning,
  CircleAlert,
  CircleArrowUp,
  Download,
  FolderSymlink,
  Gauge,
  LibraryBig,
  LoaderCircle,
  RefreshCw,
  Server,
  TrendingUp,
} from "lucide-react";
import { useId, type ReactNode } from "react";
import { locale, useT } from "../i18n";
import { cx } from "../lib/cx";
import { issueText, relativeTime } from "../lib/format";
import { isUnused, loadsEverywhere, sessionTokens, shortCount } from "../lib/insights";
import type { SortKey } from "../lib/prefs";
import { updatable, useStore } from "../store";
import { Button, card } from "./ui";
import { mcpMeta } from "./McpServers";
import { Sparkline } from "./Sparkline";

const TOP = 8;
/** Chart tiles take two columns once the grid has three. */
const wide = "@min-[924px]:col-span-2";

function Tile({
  title,
  icon: Icon,
  children,
  actions,
  className,
}: {
  title: string;
  icon: typeof Gauge;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx(card, "flex flex-col p-4", className)}>
      <h2 id={id} className="mb-3 flex items-center gap-2 text-[11px] font-semibold tracking-wider text-muted uppercase">
        <Icon aria-hidden className="size-4" />
        {title}
      </h2>
      <div className="flex-1">{children}</div>
      {actions && <div className="mt-4 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}

function Big({ value, label, tone }: { value: ReactNode; label: string; tone?: string }) {
  return (
    <p>
      <span className={cx("block text-3xl font-semibold tracking-tight tabular-nums", tone)}>{value}</span>
      <span className="text-[13px] text-muted">{label}</span>
    </p>
  );
}

interface Bar {
  id: string;
  name: string;
  value: number;
  /** The value as shown at the bar's tip. */
  text: string;
  /** Shown on hover and focus, and read as the row's description. */
  detail: string;
}

/** Ranked horizontal bars in the accent, largest first, value at each tip. A row opens its item in the Library. */
function RankedBars({ label, rows }: { label: string; rows: Bar[] }) {
  const reveal = useStore((s) => s.reveal);
  const id = useId();
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ol aria-label={label} className="mt-4 space-y-0.5">
      {rows.map((r, i) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => reveal(r.id)}
            aria-describedby={`${id}-${i}`}
            className="group relative grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 rounded-md px-1.5 py-1 text-left text-xs transition-colors duration-100 hover:bg-surface-hover focus-visible:bg-surface-hover"
          >
            <span className="truncate">{r.name}</span>
            <span className="flex min-w-0 items-center gap-2">
              {/* Leaves 56px for the value, so the longest bar's label still fits. */}
              <span
                aria-hidden
                className="h-2.5 shrink-0 rounded-e-[4px] bg-accent transition-opacity duration-100 group-hover:opacity-80"
                style={{ width: `max(2px, calc((100% - 56px) * ${r.value / max}))` }}
              />
              <span className="font-mono text-muted tabular-nums">{r.text}</span>
            </span>
            <span
              id={`${id}-${i}`}
              aria-hidden
              className="pointer-events-none absolute bottom-full left-[40%] z-10 mb-1 rounded-md border border-card-border bg-surface px-2 py-1 whitespace-nowrap opacity-0 shadow-lg transition-opacity duration-100 group-hover:opacity-100 group-focus-visible:opacity-100"
            >
              <span className="font-semibold">{r.text}</span> <span className="text-muted">{r.detail}</span>
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

export function Overview() {
  const t = useT();
  const items = useStore((s) => s.items);
  const usage = useStore((s) => s.usage);
  const progress = useStore((s) => s.usageProgress);
  const mcp = useStore((s) => s.mcp);
  const mcpBusy = useStore((s) => s.mcpBusy);
  const busy = useStore((s) => s.busy);
  const checkedAt = useStore((s) => s.checkedAt);
  const confirm = useStore((s) => s.confirm);
  const browse = useStore((s) => s.browse);
  const setScreen = useStore((s) => s.setScreen);
  const checkUpdates = useStore((s) => s.checkUpdates);
  const loadMcp = useStore((s) => s.loadMcp);

  if (!items.length)
    return (
      <div className={cx(card, "mx-5 mb-4 flex flex-1 items-center justify-center gap-2 text-[13px] text-muted")}>
        {busy === "scanning" ? (
          <>
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            {t("overview.scanning")}
          </>
        ) : (
          t("overview.noItems")
        )}
      </div>
    );

  const pending = updatable(items);
  const tokens = sessionTokens(items);
  const heavy = items
    .filter((i) => loadsEverywhere(i) && i.cost?.total)
    .sort((a, b) => (b.cost?.total ?? 0) - (a.cost?.total ?? 0))
    .slice(0, TOP);
  // usage.rs credits uses by kind and name, so installs that share both report the same uses: count them once.
  // An install outside projects sees every transcript, so its uses already hold its project copies' uses.
  const groups = new Map<string, typeof items>();
  for (const i of items) {
    const key = `${i.kind}:${i.name}`;
    groups.set(key, [...(groups.get(key) ?? []), i]);
  }
  // shortcut: same-named project items each count their own project, so nested project folders count twice; move this into usage.rs if that shows up.
  const counted = [...groups.values()].flatMap((g) => g.find((i) => i.source !== "project") ?? g);
  const used = usage
    ? counted
        .filter((i) => usage[i.id]?.uses)
        .sort((a, b) => usage[b.id].uses - usage[a.id].uses)
        .slice(0, TOP)
    : [];
  const totalUses = usage ? counted.reduce((n, i) => n + (usage[i.id]?.uses ?? 0), 0) : 0;
  // All uses per day, for the 30-day trend.
  const daily = Array.from({ length: 30 }, (_, d) => counted.reduce((n, i) => n + (usage?.[i.id]?.daily[d] ?? 0), 0));
  const unused = usage ? items.filter((i) => isUnused(i, usage)) : null;
  const unusedTokens = unused?.reduce((n, i) => n + (i.cost?.total ?? 0), 0) ?? 0;
  const withIssues = items.filter((i) => i.issues.length);
  const moved = items.filter((i) => i.status === "moved").length;
  const removed = items.filter((i) => i.status === "removed").length;
  const problems = (mcp?.servers.filter((s) => s.state !== "connected") ?? []).sort((a, b) => mcpMeta[a.state].order - mcpMeta[b.state].order);
  const plugins = items.filter((i) => i.kind === "plugin");
  const off = plugins.filter((i) => i.enabled === false).length;

  const sortBy = (key: SortKey) => {
    useStore.setState({ sort: { key, desc: true } });
    browse({});
  };

  return (
    <div className="@container grid min-h-0 flex-1 grid-flow-row-dense auto-rows-min grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-3 overflow-y-auto px-5 pb-4">
      <Tile
        title={t("overview.updates")}
        icon={CircleArrowUp}
        actions={
          pending.length ? (
            <>
              <Button variant="update" size="sm" onClick={() => confirm({ type: "update", items: pending })}>
                <Download aria-hidden className="size-3.5" />
                {t("overview.review", { count: pending.length })}
              </Button>
              <Button size="sm" onClick={() => browse({ statuses: ["updateAvailable"] })}>
                {t("overview.showInLibrary")}
              </Button>
            </>
          ) : (
            <Button size="sm" disabled={busy !== "idle"} onClick={() => void checkUpdates()}>
              <RefreshCw aria-hidden className={cx("size-3.5", busy === "checking" && "animate-spin")} />
              {t("overview.checkNow")}
            </Button>
          )
        }
      >
        <Big
          value={pending.length || t("overview.none")}
          tone={pending.length ? "text-warn" : undefined}
          label={pending.length ? t("overview.pending", { count: pending.length }) : t("overview.upToDate")}
        />
        <p className="mt-1 text-xs text-muted">{checkedAt ? t("overview.checked", { time: relativeTime(checkedAt) }) : t("overview.notChecked")}</p>
      </Tile>

      <Tile
        title={t("overview.context")}
        icon={Gauge}
        className={wide}
        actions={
          <Button size="sm" onClick={() => sortBy("cost")}>
            {t("overview.sortByCost")}
          </Button>
        }
      >
        <Big value={`≈${shortCount(tokens)}`} label={t("overview.tokensLabel")} />
        {heavy.length > 0 && (
          <RankedBars
            label={t("overview.heaviest")}
            rows={heavy.map((i) => ({
              id: i.id,
              name: i.name,
              value: i.cost?.total ?? 0,
              text: `≈${shortCount(i.cost?.total ?? 0)}`,
              detail: t("overview.share", { percent: Math.round(((i.cost?.total ?? 0) / Math.max(1, tokens)) * 100) }),
            }))}
          />
        )}
      </Tile>

      <Tile
        title={t("overview.mostUsed")}
        icon={TrendingUp}
        className={wide}
        actions={
          used.length > 0 && (
            <Button size="sm" onClick={() => sortBy("uses")}>
              {t("overview.sortByUses")}
            </Button>
          )
        }
      >
        {usage ? (
          <>
            <div className="flex items-end justify-between gap-4">
              <Big value={totalUses.toLocaleString(locale())} label={t("overview.usesLabel", { count: totalUses })} />
              <Sparkline daily={daily} className="mb-1 h-10 w-40 shrink-0" />
            </div>
            {used.length > 0 && (
              <RankedBars
                label={t("overview.topUsed")}
                rows={used.map((i) => ({
                  id: i.id,
                  name: i.name,
                  value: usage[i.id].uses,
                  text: String(usage[i.id].uses),
                  detail: t("detail.lastUsed", { time: relativeTime(usage[i.id].lastUsed) }),
                }))}
              />
            )}
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            {progress?.total ? t("cleanup.countingProgress", { read: progress.read, total: progress.total }) : t("cleanup.counting")}
          </p>
        )}
      </Tile>

      <Tile
        title={t("cleanup.unused")}
        icon={BrushCleaning}
        actions={
          unused && (
            <Button size="sm" onClick={() => setScreen("cleanup")}>
              {t("overview.openCleanUp")}
            </Button>
          )
        }
      >
        {unused ? (
          <>
            <Big value={unused.length} label={t("overview.unused", { count: unused.length })} />
            {unusedTokens > 0 && <p className="mt-1 text-xs text-muted">{t("overview.unusedFrees", { tokens: shortCount(unusedTokens) })}</p>}
          </>
        ) : (
          <p className="flex items-center gap-1.5 text-[13px] text-muted">
            <LoaderCircle aria-hidden className="size-4 animate-spin" />
            {progress?.total ? t("cleanup.countingProgress", { read: progress.read, total: progress.total }) : t("cleanup.counting")}
          </p>
        )}
      </Tile>

      <Tile
        title={t("overview.mcp")}
        icon={Server}
        actions={
          mcp ? (
            <Button size="sm" onClick={() => setScreen("mcp")}>
              {t("overview.openMcp")}
            </Button>
          ) : (
            <Button size="sm" disabled={mcpBusy} onClick={() => void loadMcp()}>
              {mcpBusy ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : <RefreshCw aria-hidden className="size-3.5" />}
              {mcpBusy ? t("mcp.checking") : t("mcp.check")}
            </Button>
          )
        }
      >
        {mcp ? (
          <>
            <Big
              value={problems.length ? problems.length : mcp.servers.length}
              tone={problems.length ? "text-danger" : undefined}
              label={
                problems.length
                  ? t("overview.mcpAttention", { count: problems.length, total: mcp.servers.length })
                  : t("overview.mcpConnected", { count: mcp.servers.length })
              }
            />
            {problems.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs">
                {problems.slice(0, 3).map((s) => (
                  <li key={`${s.plugin}:${s.name}`} className="flex gap-2">
                    <span className="min-w-0 flex-1 truncate font-mono">{s.name}</span>
                    <span className="shrink-0 text-muted">{t(mcpMeta[s.state].label)}</span>
                  </li>
                ))}
              </ul>
            )}
          </>
        ) : (
          <p className="text-[13px] text-muted">
            {mcpBusy
              ? t("overview.mcpConnecting")
              : t("overview.mcpNotChecked")}
          </p>
        )}
      </Tile>

      <Tile
        title={t("overview.health")}
        icon={CircleAlert}
        actions={
          withIssues.length > 0 && (
            <Button size="sm" onClick={() => browse({ flags: ["issues"] })}>
              {t("overview.showInLibrary")}
            </Button>
          )
        }
      >
        <Big
          value={withIssues.length || t("overview.none")}
          tone={withIssues.length ? "text-danger" : undefined}
          label={withIssues.length ? t("overview.withIssues", { count: withIssues.length }) : t("overview.noIssues")}
        />
        {withIssues.length > 0 && <p className="mt-1 line-clamp-2 text-xs text-muted">{issueText(withIssues[0].issues[0])}</p>}
      </Tile>

      <Tile
        title={t("overview.changed")}
        icon={FolderSymlink}
        actions={
          moved + removed > 0 && (
            <Button size="sm" onClick={() => setScreen("cleanup")}>
              {t("overview.openCleanUp")}
            </Button>
          )
        }
      >
        <Big
          value={moved + removed || t("overview.none")}
          label={moved + removed ? t("overview.changedCounts", { moved, removed }) : t("overview.noChanges")}
        />
      </Tile>

      <Tile
        title={t("rail.library")}
        icon={LibraryBig}
        actions={
          <Button size="sm" onClick={() => browse({})}>
            {t("overview.openLibrary")}
          </Button>
        }
      >
        <dl className="grid grid-cols-[1fr_auto] gap-y-1 text-[13px]">
          <dt className="text-muted">{t("overview.plugins")}</dt>
          <dd className="text-right font-mono tabular-nums">{plugins.length}</dd>
          <dt className="text-muted">{t("overview.turnedOff")}</dt>
          <dd className="text-right font-mono tabular-nums">{off}</dd>
          <dt className="text-muted">{t("overview.skills")}</dt>
          <dd className="text-right font-mono tabular-nums">{items.length - plugins.length}</dd>
        </dl>
      </Tile>
    </div>
  );
}
