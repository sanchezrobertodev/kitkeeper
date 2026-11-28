import { Bot, Copy, Download, Ellipsis, Hammer, Info, Plug, Power, PowerOff, RotateCcw, ScrollText, SquareTerminal, X } from "lucide-react";
import { useCallback, useLayoutEffect, useRef, useState } from "react";
import { type TKey, useT } from "../i18n";
import { showsChangelog } from "../lib/changelog";
import { cx } from "../lib/cx";
import { canReinstall, canToggle, canUpdate, fullDate, kindLabel, sourceHelp, sourceLabel } from "../lib/format";
import { isActive, useStore } from "../store";
import type { Child, Item } from "../types";
import { ChangelogPanel } from "./Changelog";
import { ContextMenu, type MenuTarget } from "./ContextMenu";
import { CostSection, IssueList, LastRunSection, ReadmeSection, UpstreamNote, UsageSection } from "./DetailSections";
import { Button, card, IconButton, KindIcon, StatusBadge } from "./ui";

const childMeta: Record<Child["kind"], { label: TKey; icon: typeof Bot }> = {
  skill: { label: "detail.children.skill", icon: ScrollText },
  command: { label: "detail.children.command", icon: SquareTerminal },
  agent: { label: "detail.children.agent", icon: Bot },
  mcp: { label: "detail.children.mcp", icon: Plug },
  hook: { label: "detail.children.hook", icon: Hammer },
};

function Fact({ label, children, mono }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <>
      <dt className="text-muted">{label}</dt>
      <dd className={cx("min-w-0 break-words", mono && "font-mono text-xs leading-5")}>{children}</dd>
    </>
  );
}

/** About four lines, with Show more when the text runs longer. Keyed by item, so it starts collapsed for each one. */
function Description({ text }: { text: string }) {
  const t = useT();
  const ref = useRef<HTMLParagraphElement>(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && !open) setLong(el.scrollHeight > el.clientHeight + 1);
  }, [text, open]);
  return (
    <div className="mt-1.5">
      <p ref={ref} className={cx("text-[13px] leading-relaxed text-muted", !open && "line-clamp-3")}>
        {text}
      </p>
      {long && (
        <Button size="sm" variant="ghost" className="-ml-2.5 text-muted" aria-expanded={open} onClick={() => setOpen(!open)}>
          {open ? t("detail.showLess") : t("detail.showMore")}
        </Button>
      )}
    </div>
  );
}

export function DetailPanel({ item, overlay }: { item: Item; overlay: boolean }) {
  const t = useT();
  const busy = useStore((s) => s.busy);
  const run = useStore((s) => s.run);
  const confirm = useStore((s) => s.confirm);
  const closeDetail = useStore((s) => s.closeDetail);
  const jobs = useStore((s) => s.jobs);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [menu, setMenu] = useState<MenuTarget | null>(null);
  const closeMenu = useCallback(() => setMenu(null), []);

  const mine = Object.values(jobs).filter((j) => j.itemId === item.id);
  const running = mine.some(isActive);
  const finished = mine.length - mine.filter(isActive).length;
  const update = item.status === "updateAvailable" && canUpdate(item);

  const copyPath = async () => {
    if (!item.path) return;
    try {
      await navigator.clipboard.writeText(item.path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setError(t("detail.copyFailed"));
    }
  };

  return (
    <aside
      aria-label={t("detail.label", { name: item.name })}
      className={cx(
        "flex w-[344px] shrink-0 flex-col overflow-hidden",
        card,
        overlay && "absolute inset-y-0 right-0 z-30 shadow-2xl",
      )}
    >
      <div className="border-b border-border px-5 py-4">
        <div className="flex items-start gap-3">
          <KindIcon kind={item.kind} className="mt-1 size-5" />
          <h2 className="min-w-0 flex-1 truncate text-base font-semibold" title={item.name}>
            {item.name}
          </h2>
          <IconButton label={t("detail.close")} onClick={closeDetail} className="-mt-1.5 -mr-2">
            <X className="size-4" />
          </IconButton>
        </div>
        {item.description && <Description key={item.id} text={item.description} />}
        <div className="mt-3 flex gap-2">
          {update ? (
            <Button variant="update" className="flex-1" disabled={running} onClick={() => confirm({ type: "update", items: [item] })}>
              <Download aria-hidden className="size-4" />
              {t("detail.updateTo", { version: item.latest ?? t("detail.latestVersion") })}
            </Button>
          ) : canReinstall(item) ? (
            <Button variant="primary" className="flex-1" disabled={running} onClick={() => void run([{ itemId: item.id, action: "reinstall" }])}>
              <RotateCcw aria-hidden className="size-4" />
              {t("detail.reinstall")}
            </Button>
          ) : (
            canUpdate(item) && (
              <Button disabled={running} onClick={() => confirm({ type: "update", items: [item] })}>
                <Download aria-hidden className="size-4" />
                {t("detail.update")}
              </Button>
            )
          )}
          {canToggle(item) && (
            <Button disabled={running} onClick={() => void run([{ itemId: item.id, action: item.enabled ? "disable" : "enable" }])}>
              {item.enabled ? <PowerOff aria-hidden className="size-4" /> : <Power aria-hidden className="size-4" />}
              {item.enabled ? t("detail.disable") : t("detail.enable")}
            </Button>
          )}
          <IconButton
            label={t("menu.itemActions", { name: item.name })}
            aria-haspopup="menu"
            aria-expanded={!!menu}
            className="border border-border-strong"
            onClick={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setMenu(menu ? null : { x: r.right - 192, y: r.bottom + 4, items: [item] });
            }}
          >
            <Ellipsis className="size-4" />
          </IconButton>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {item.statusDetail && item.status !== "upToDate" && !item.upstream && (
          <p className="mb-3 text-[13px] text-muted">{item.statusDetail}</p>
        )}
        <UpstreamNote item={item} onError={setError} />

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            {error}
          </p>
        )}

        <dl className="mb-6 grid grid-cols-[104px_1fr] items-center gap-x-3 gap-y-2 text-[13px]">
          <Fact label={t("detail.type")}>
            {kindLabel[item.kind]}
            {item.enabled === false && <span className="text-muted"> · {t("detail.disabled")}</span>}
          </Fact>
          <Fact label={t("detail.source")}>
            <span title={sourceHelp[item.source]}>{sourceLabel[item.source]}</span>
          </Fact>
          {item.origin && <Fact label={item.kind === "plugin" ? t("source.marketplace") : t("detail.from")} mono>{item.origin}</Fact>}
          {item.scope && <Fact label={t("detail.scope")}>{item.scope}</Fact>}
          <Fact label={t("list.colStatus")}>
            <StatusBadge status={item.status} checking={busy === "checking"} />
          </Fact>
          <Fact label={t("detail.version")} mono>
            {item.version ?? "—"}
            {item.latest && item.latest !== item.version && (
              <>
                <span className="text-muted"> → </span>
                <span className={cx(item.status === "updateAvailable" && "font-medium text-warn")}>{item.latest}</span>
              </>
            )}
          </Fact>
          {item.installedAt && <Fact label={t("detail.installed")}>{fullDate(item.installedAt)}</Fact>}
          {item.updatedAt && item.updatedAt !== item.installedAt && <Fact label={t("detail.updated")}>{fullDate(item.updatedAt)}</Fact>}
          {Object.entries(item.meta).map(([k, v]) => (
            <Fact key={k} label={k} mono>
              {v}
            </Fact>
          ))}
        </dl>

        {/* For a pending update, what changed comes first. */}
        {item.status === "updateAvailable" && <ChangelogPanel item={item} />}

        {item.notes.length > 0 && (
          <ul className="mb-5 space-y-2">
            {item.notes.map((n) => (
              <li key={n} className="flex gap-2 rounded-md border border-info/30 bg-info/10 px-3 py-2 text-[13px]">
                <Info aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
                {n}
              </li>
            ))}
          </ul>
        )}

        <IssueList item={item} />

        <CostSection item={item} />
        <UsageSection item={item} />


        {item.path && (
          <div className="mb-6">
            <h3 className="mb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{t("detail.location")}</h3>
            <div className="flex items-start gap-1 rounded-md border border-border bg-bg p-2">
              <code className="min-w-0 flex-1 font-mono text-xs leading-5 break-all">{item.path}</code>
              <IconButton label={copied ? t("detail.copied") : t("detail.copyPath")} className="size-7" onClick={() => void copyPath()}>
                <Copy className="size-3.5" />
              </IconButton>
            </div>
          </div>
        )}

        <ReadmeSection item={item} />
        <LastRunSection item={item} finished={finished} />

        {item.status !== "updateAvailable" && showsChangelog(item) && <ChangelogPanel item={item} />}

        <ChildGroups items={item.children} />
      </div>
      {menu && <ContextMenu target={menu} onClose={closeMenu} />}
    </aside>
  );
}

/** A plugin's skills, commands, agents, MCP servers and hooks, one list per kind. */
export function ChildGroups({ items }: { items: Child[] }) {
  const t = useT();
  const groups = (Object.keys(childMeta) as Child["kind"][])
    .map((k) => ({ kind: k, list: items.filter((c) => c.kind === k) }))
    .filter((g) => g.list.length);
  return groups.map(({ kind, list }) => {
    const { label, icon: Icon } = childMeta[kind];
    return (
      <section key={kind} className="mb-5">
        <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">
          <Icon aria-hidden className="size-3.5" />
          {t(label)} <span className="font-mono">{list.length}</span>
        </h3>
        <ul className="divide-y divide-border rounded-md border border-border">
          {list.map((c) => (
            <li key={c.name} className="px-3 py-2">
              <div className="font-mono text-xs font-medium">{c.name}</div>
              {c.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{c.description}</p>}
            </li>
          ))}
        </ul>
      </section>
    );
  });
}
