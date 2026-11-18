import { CircleAlert, Compass, LoaderCircle, Plus, Puzzle } from "lucide-react";
import { useDeferredValue, useEffect, useId, useState, type ReactNode } from "react";
import { useT } from "../i18n";
import { cx } from "../lib/cx";
import { shortCount } from "../lib/insights";
import { isActive, useStore } from "../store";
import type { CatalogEntry } from "../types";
import { RiskChip } from "./ReviewSheet";
import { Button, card } from "./ui";

const selectCls = "h-8 max-w-48 rounded-lg border border-border-strong bg-surface px-2 text-[13px] text-fg hover:bg-surface-hover";

/** Every word of the search appears in the name, description, category, author, marketplace or a skill's name. */
function matches(e: CatalogEntry, query: string) {
  const words = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!words.length) return true;
  const text = [e.name, e.description, e.category, e.author, e.marketplace, ...(e.contents?.children.map((c) => c.name) ?? [])]
    .join(" ")
    .toLowerCase();
  return words.every((w) => text.includes(w));
}

function Empty({ icon: Icon, title, hint, children }: { icon: typeof Compass; title: string; hint?: string; children?: ReactNode }) {
  return (
    <div className={cx(card, "flex shrink-0 flex-col items-center gap-2 p-8 text-center")}>
      <Icon aria-hidden className="size-8 text-muted" />
      <p className="font-medium">{title}</p>
      {hint && <p className="max-w-sm text-[13px] text-muted">{hint}</p>}
      {children}
    </div>
  );
}

function Row({ entry, installing }: { entry: CatalogEntry; installing: boolean }) {
  const t = useT();
  const confirm = useStore((s) => s.confirm);
  const review = () => confirm({ type: "install", entry });
  const cost = entry.contents?.cost?.total;
  const risks = entry.contents?.risks ?? [];
  return (
    // content-visibility skips laying out rows scrolled out of view; there can be hundreds.
    <li className="flex items-start gap-3 px-4 py-3 [contain-intrinsic-size:auto_84px] [content-visibility:auto]">
      <Puzzle aria-hidden className="mt-0.5 size-4 shrink-0 text-info" />
      <div className="min-w-0 flex-1">
        <div className="flex min-w-0 items-baseline gap-2">
          <button type="button" onClick={review} className="truncate rounded text-left text-[13px] font-medium hover:underline">
            {entry.name}
          </button>
          <span className="truncate text-xs text-muted">{[entry.marketplace, entry.category].filter(Boolean).join(" · ")}</span>
        </div>
        {entry.description && <p className="mt-0.5 line-clamp-2 max-w-prose text-xs text-muted">{entry.description}</p>}
        {(cost || risks.length > 0 || !entry.contents) && (
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {cost ? <span className="mr-1 font-mono text-[11px] text-muted">{t("cleanup.tokens", { tokens: shortCount(cost) })}</span> : null}
            {risks.map((r) => (
              <RiskChip key={r.kind} risk={r} tone="info" />
            ))}
            {!entry.contents && <span className="text-[11px] text-muted">{t("discover.unknownShort")}</span>}
          </div>
        )}
      </div>
      <Button size="sm" disabled={installing} onClick={review} aria-label={t("discover.installName", { name: entry.name })}>
        {installing ? <LoaderCircle aria-hidden className="size-3.5 animate-spin" /> : <Plus aria-hidden className="size-3.5" />}
        {installing ? t("discover.installing") : t("discover.install")}
      </Button>
    </li>
  );
}

/** Plugins your marketplaces list that you haven't installed, each with a review before it installs. */
export function Discover() {
  const t = useT();
  const catalog = useStore((s) => s.catalog);
  const error = useStore((s) => s.catalogError);
  const items = useStore((s) => s.items);
  const jobs = useStore((s) => s.jobs);
  const checkedAt = useStore((s) => s.checkedAt);
  const query = useDeferredValue(useStore((s) => s.discoverQuery));
  const setQuery = useStore((s) => s.setDiscoverQuery);
  const [marketplace, setMarketplace] = useState("");
  const [category, setCategory] = useState("");
  const id = useId();

  // A check refreshes the marketplaces, so their lists are read again after one.
  useEffect(() => {
    void useStore.getState().loadCatalog();
  }, [checkedAt]);

  const installed = new Set(items.filter((i) => i.kind === "plugin").map((i) => `${i.name}@${i.origin}`));
  const installing = new Set(Object.values(jobs).filter((j) => isActive(j) && j.action === "install").map((j) => j.itemId));
  const available = (catalog ?? []).filter((e) => !installed.has(e.id)).sort((a, b) => a.name.localeCompare(b.name));
  const marketplaces = [...new Set(available.map((e) => e.marketplace))].sort();
  const categories = [...new Set(available.flatMap((e) => (e.category ? [e.category] : [])))].sort();
  const rows = available.filter((e) => (!marketplace || e.marketplace === marketplace) && (!category || e.category === category) && matches(e, query));
  const filtered = !!(marketplace || category || query.trim());

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 pb-4">
      <div className={cx(card, "flex shrink-0 flex-wrap items-center gap-3 px-4 py-3")}>
        <div className="min-w-0 flex-1">
          <p className="text-[13px]" aria-live="polite">
            {!catalog
              ? t("discover.loading")
              : filtered
                ? t("discover.matching", { count: rows.length })
                : t("discover.available", { count: available.length })}
          </p>
          <p className="text-xs text-muted">{t("discover.hint")}</p>
        </div>
        <label htmlFor={`${id}-m`} className="sr-only">
          {t("discover.marketplace")}
        </label>
        <select id={`${id}-m`} className={selectCls} value={marketplace} onChange={(e) => setMarketplace(e.target.value)}>
          <option value="">{t("discover.allMarketplaces")}</option>
          {marketplaces.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <label htmlFor={`${id}-c`} className="sr-only">
          {t("discover.category")}
        </label>
        <select id={`${id}-c`} className={selectCls} value={category} onChange={(e) => setCategory(e.target.value)}>
          <option value="">{t("discover.allCategories")}</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {error && (
        <div role="alert" className="flex shrink-0 items-start gap-2 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-[13px]">
          <CircleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-danger" />
          <p className="min-w-0 flex-1">{t("discover.failed", { error })}</p>
        </div>
      )}

      {catalog &&
        (catalog.length === 0 ? (
          <Empty icon={Compass} title={t("discover.empty")} hint={t("discover.emptyHint")} />
        ) : available.length === 0 ? (
          <Empty icon={Compass} title={t("discover.allInstalled")} />
        ) : rows.length === 0 ? (
          <Empty icon={Compass} title={t("discover.noMatch")}>
            <Button
              size="sm"
              onClick={() => {
                setQuery("");
                setMarketplace("");
                setCategory("");
              }}
            >
              {t("discover.clear")}
            </Button>
          </Empty>
        ) : (
          <ul aria-label={t("rail.discover")} className={cx(card, "shrink-0 divide-y divide-border overflow-hidden")}>
            {rows.map((e) => (
              <Row key={e.id} entry={e} installing={installing.has(e.id)} />
            ))}
          </ul>
        ))}
    </div>
  );
}
