import {
  ArrowRight,
  BrushCleaning,
  CircleAlert,
  CircleArrowUp,
  FolderSymlink,
  Gauge,
  LoaderCircle,
  RefreshCw,
  Server,
  TrendingUp,
} from "lucide-react";
import { useId, type ButtonHTMLAttributes, type ReactNode } from "react";
import { locale, useT } from "../i18n";
import { cx } from "../lib/cx";
import { kindLabel, relativeTime } from "../lib/format";
import { isUnused, loadsEverywhere, sessionTokens, shortCount } from "../lib/insights";
import type { SortKey } from "../lib/prefs";
import { updatable, useStore } from "../store";
import type { Kind } from "../types";
import { Button, card } from "./ui";
import { mcpMeta } from "./McpServers";
import { Sparkline } from "./Sparkline";

const TOP = 8;

const tones = {
  danger: "text-danger bg-danger/10 border-danger/35",
  info: "text-info bg-info/10 border-info/30",
  muted: "text-muted bg-surface-2 border-border",
};

/** One headline number: what it counts, the number, a line of context and at most one way to act on it. */
function Kpi({
  title,
  icon: Icon,
  value,
  tone,
  note,
  footer,
}: {
  title: string;
  icon: typeof Gauge;
  value: ReactNode;
  tone?: string;
  note: ReactNode;
  footer?: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx(card, "flex min-w-0 flex-col gap-1 p-4")}>
      <h2 id={id} className="flex items-center gap-2 text-[13px] font-medium text-muted">
        <Icon aria-hidden className="size-4 shrink-0" />
        <span className="truncate">{title}</span>
      </h2>
      <p className={cx("text-[26px] leading-tight font-semibold tracking-tight tabular-nums", tone)}>{value}</p>
      <p className="text-[13px] text-muted">{note}</p>
      {footer && <div className="mt-auto pt-2">{footer}</div>}
    </section>
  );
}

/** A text link with an arrow: the quiet way to act on a card, so the screen keeps one primary button. */
function LinkButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className="inline-flex items-center gap-1 rounded text-[13px] font-medium whitespace-nowrap text-accent hover:enabled:underline disabled:opacity-50"
      {...rest}
    >
      {children}
      <ArrowRight aria-hidden className="size-3.5" />
    </button>
  );
}

function Panel({
  title,
  note,
  action,
  flush,
  children,
}: {
  title: string;
  note?: ReactNode;
  action?: ReactNode;
  /** Children run edge to edge (a divided list) instead of sitting in the padding. */
  flush?: boolean;
  children: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cx(card, "flex min-w-0 flex-col")}>
      <header className="flex min-h-12 items-center gap-2 border-b border-border px-4 py-2">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        {note != null && <span className="text-[13px] text-muted">{note}</span>}
        {action && <div className="ml-auto">{action}</div>}
      </header>
      <div className={cx("flex-1", !flush && "p-3")}>{children}</div>
    </section>
  );
}

/** A row of the Issues card: a labelled chip (icon and text, never colour alone), what's wrong, and the fix. */
function Issue({
  icon: Icon,
  label,
  tone,
  children,
  action,
}: {
  icon: typeof Gauge;
  label: string;
  tone: keyof typeof tones;
  children: ReactNode;
  action: ReactNode;
}) {
  return (
    <li className="grid grid-cols-[minmax(0,168px)_minmax(0,1fr)_auto] items-center gap-3 px-4 py-2.5 text-[13px]">
      <span className={cx("inline-flex h-6 w-fit max-w-full items-center gap-1 rounded-full border px-2 text-xs font-medium whitespace-nowrap", tones[tone])}>
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
      </span>
      <span className="min-w-0 font-medium">{children}</span>
      {action}
    </li>
  );
}

interface Bar {
  id: string;
  name: string;
  kind: Kind;
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
  const names = rows.map((r) => r.name);
  return (
    <ol aria-label={label} className="space-y-0.5">
      {rows.map((r, i) => (
        <li key={r.id}>
          <button
            type="button"
            onClick={() => reveal(r.id)}
            aria-describedby={`${id}-${i}`}
            className="group relative grid w-full grid-cols-[minmax(0,2fr)_minmax(0,3fr)] items-center gap-3 rounded-md px-1.5 py-1 text-left text-xs transition-colors duration-100 hover:bg-surface-hover focus-visible:bg-surface-hover"
          >
            <span className="truncate">
              {r.name}
              {/* A plugin and a skill can share a name. */}
              {names.indexOf(r.name) !== names.lastIndexOf(r.name) && <span className="text-muted"> · {kindLabel[r.kind]}</span>}
            </span>
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

  const sortBy = (key: SortKey) => {
    useStore.setState({ sort: { key, desc: true } });
    browse({});
  };
  const counting = (
    <span className="inline-flex items-center gap-1.5">
      <LoaderCircle aria-hidden className="size-4 animate-spin" />
      {progress?.total ? t("cleanup.countingProgress", { percent: Math.floor((progress.read / progress.total) * 100) }) : t("cleanup.counting")}
    </span>
  );
  const issues = [
    mcp
      ? problems.length > 0 && (
          <Issue
            key="mcp"
            icon={mcpMeta[problems[0].state].icon}
            label={t("overview.mcp")}
            tone={problems[0].state === "failed" ? "danger" : "info"}
            action={
              <Button size="sm" onClick={() => setScreen("mcp")}>
                {t("overview.openMcp")}
              </Button>
            }
          >
            {problems.length} {t("overview.mcpAttention", { count: problems.length, total: mcp.servers.length })}
          </Issue>
        )
      : (
          <Issue
            key="mcp"
            icon={Server}
            label={t("overview.mcp")}
            tone="muted"
            action={
              <Button size="sm" disabled={mcpBusy} onClick={() => void loadMcp()}>
                {mcpBusy ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : <RefreshCw aria-hidden className="size-3.5" />}
                {mcpBusy ? t("mcp.checking") : t("mcp.check")}
              </Button>
            }
          >
            <span className="font-normal text-muted">{mcpBusy ? t("overview.mcpConnecting") : t("overview.notChecked")}</span>
          </Issue>
        ),
    withIssues.length > 0 && (
      <Issue
        key="health"
        icon={CircleAlert}
        label={t("overview.health")}
        tone="danger"
        action={
          <Button size="sm" onClick={() => browse({ flags: ["issues"] })}>
            {t("overview.showInLibrary")}
          </Button>
        }
      >
        {withIssues.length} {t("overview.withIssues", { count: withIssues.length })}
      </Issue>
    ),
    moved + removed > 0 && (
      <Issue
        key="changed"
        icon={FolderSymlink}
        label={t("overview.changed")}
        tone="info"
        action={
          <Button size="sm" onClick={() => setScreen("cleanup")}>
            {t("overview.openCleanUp")}
          </Button>
        }
      >
        {t("overview.changedCounts", { moved, removed })}
      </Issue>
    ),
  ].filter(Boolean);
  // The "not checked yet" MCP row is an offer, not a problem, so it isn't counted.
  const issueCount = issues.length - (mcp ? 0 : 1);

  return (
    <div className="@container flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-5 pb-4">
      <div className="grid grid-cols-2 gap-4 @min-[760px]:grid-cols-4">
        <Kpi
          title={t("overview.updates")}
          icon={CircleArrowUp}
          value={pending.length || t("overview.none")}
          tone={pending.length ? "text-warn" : undefined}
          note={checkedAt ? t("overview.checked", { time: relativeTime(checkedAt) }) : t("overview.notChecked")}
          footer={
            pending.length ? (
              <LinkButton onClick={() => confirm({ type: "update", items: pending })}>{t("overview.review", { count: pending.length })}</LinkButton>
            ) : (
              <LinkButton disabled={busy !== "idle"} onClick={() => void checkUpdates()}>
                {t("overview.checkNow")}
              </LinkButton>
            )
          }
        />
        <Kpi title={t("overview.context")} icon={Gauge} value={`≈${shortCount(tokens)}`} note={t("overview.tokensLabel")} />
        <Kpi
          title={t("overview.uses")}
          icon={TrendingUp}
          value={usage ? totalUses.toLocaleString(locale()) : "…"}
          note={usage ? t("overview.usesLabel", { count: totalUses }) : counting}
          footer={usage && <Sparkline daily={daily} className="h-6 w-full" />}
        />
        <Kpi
          title={t("cleanup.unused")}
          icon={BrushCleaning}
          value={unused ? unused.length : "…"}
          note={unused ? (unusedTokens > 0 ? t("overview.unusedFrees", { tokens: shortCount(unusedTokens) }) : t("overview.unused", { count: unused.length })) : counting}
          footer={unused && unused.length > 0 && <LinkButton onClick={() => setScreen("cleanup")}>{t("overview.openCleanUp")}</LinkButton>}
        />
      </div>

      <div className="grid gap-4 @min-[860px]:grid-cols-[3fr_2fr]">
        <Panel title={t("overview.context")} action={<LinkButton onClick={() => sortBy("cost")}>{t("overview.sortByCost")}</LinkButton>}>
          <RankedBars
            label={t("overview.heaviest")}
            rows={heavy.map((i) => ({
              id: i.id,
              name: i.name,
              kind: i.kind,
              value: i.cost?.total ?? 0,
              text: `≈${shortCount(i.cost?.total ?? 0)}`,
              detail: t("overview.share", { percent: Math.round(((i.cost?.total ?? 0) / Math.max(1, tokens)) * 100) }),
            }))}
          />
        </Panel>
        <Panel
          title={t("overview.mostUsed")}
          action={used.length > 0 && <LinkButton onClick={() => sortBy("uses")}>{t("overview.sortByUses")}</LinkButton>}
        >
          {usage ? (
            <RankedBars
              label={t("overview.topUsed")}
              rows={used.map((i) => ({
                id: i.id,
                name: i.name,
                kind: i.kind,
                value: usage[i.id].uses,
                text: String(usage[i.id].uses),
                detail: t("detail.lastUsed", { time: relativeTime(usage[i.id].lastUsed) }),
              }))}
            />
          ) : (
            <p className="px-1.5 text-[13px] text-muted">{counting}</p>
          )}
        </Panel>
      </div>

      <Panel title={t("overview.issues")} note={issueCount > 0 ? issueCount : null} flush>
        {issues.length ? (
          <ul className="divide-y divide-border">{issues}</ul>
        ) : (
          <p className="px-4 py-3 text-[13px] text-muted">{t("overview.noIssues")}</p>
        )}
      </Panel>
    </div>
  );
}
