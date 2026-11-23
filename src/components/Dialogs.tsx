import { ExternalLink, Gauge, Plus, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { useState } from "react";
import { api, errorText } from "../api";
import { locale, tx, useT } from "../i18n";
import { formatBytes, sourceLabel, uninstallEffect } from "../lib/format";
import { useStore } from "../store";
import type { CatalogEntry, Item, Job } from "../types";
import { ChildGroups } from "./DetailPanel";
import { ReviewSheet, RiskChip } from "./ReviewSheet";
import { Button, KindIcon, Modal } from "./ui";

const heading = "mt-4 mb-1.5 flex items-center gap-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase";

/** What a listed plugin would add, before `claude plugin install` runs. */
function InstallDialog({ entry }: { entry: CatalogEntry }) {
  const t = useT();
  const confirm = useStore((s) => s.confirm);
  const run = useStore((s) => s.run);
  const [error, setError] = useState<string | null>(null);
  const close = () => confirm(null);
  const c = entry.contents;
  return (
    <Modal
      wide
      title={t("discover.installName", { name: entry.name })}
      onClose={close}
      footer={
        <>
          <Button data-autofocus onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              close();
              void run([{ itemId: entry.id, action: "install" }]);
            }}
          >
            <Plus aria-hidden className="size-4" />
            {t("discover.install")}
          </Button>
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
        <span>
          {[t("discover.inMarketplace", { marketplace: entry.marketplace }), entry.author && t("discover.by", { author: entry.author }), entry.version && t("discover.version", { version: entry.version })]
            .filter(Boolean)
            .join(" · ")}
        </span>
        {entry.page && (
          <Button size="sm" variant="ghost" className="-my-1 h-7 text-info" onClick={() => api.openCatalogPage(entry.id).catch((e) => setError(errorText(e)))}>
            <ExternalLink aria-hidden className="size-3.5" />
            {t("discover.homepage")}
          </Button>
        )}
      </div>
      {entry.description && <p className="mt-2 text-[13px] leading-relaxed">{entry.description}</p>}
      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      <h3 className={heading}>
        <ShieldCheck aria-hidden className="size-3.5" />
        {t("discover.runsLabel")}
      </h3>
      {c ? (
        c.risks.length ? (
          <div className="flex flex-wrap gap-1.5">
            {c.risks.map((r) => (
              <RiskChip key={r.kind} risk={r} tone="info" />
            ))}
          </div>
        ) : (
          <p className="text-[13px]">{t("discover.noRisks")}</p>
        )
      ) : (
        <p className="text-[13px]">
          {entry.source === "command" ? t("discover.fromCommand") : t("discover.unknown", { from: entry.from ?? entry.source })}
        </p>
      )}

      {c?.cost && (
        <>
          <h3 className={heading}>
            <Gauge aria-hidden className="size-3.5" />
            {t("detail.cost")}
          </h3>
          <p className="text-[13px]">
            {tx("detail.costSession", { total: <span className="font-mono font-medium">≈{c.cost.total.toLocaleString(locale())}</span> })}
          </p>
        </>
      )}

      {c && c.children.length > 0 && (
        <div className="mt-4">
          <ChildGroups items={c.children} />
        </div>
      )}
      <p className="mt-3 text-xs text-muted">{t("app.restartNeeded")}</p>
    </Modal>
  );
}

function UninstallDialog({ items }: { items: Item[] }) {
  const t = useT();
  const confirm = useStore((s) => s.confirm);
  const run = useStore((s) => s.run);
  const close = () => confirm(null);
  const many = items.length > 1;
  // Snapshot data from older builds has no dataBytes; treat undefined like null.
  const withData = items.filter((i) => i.dataBytes != null);
  const dataBytes = withData.reduce((n, i) => n + (i.dataBytes ?? 0), 0);
  const [deleteData, setDeleteData] = useState(false);
  return (
    <Modal
      title={many ? t("dialogs.uninstallMany", { count: items.length }) : t("dialogs.uninstallOne", { name: items[0].name })}
      onClose={close}
      footer={
        <>
          <Button data-autofocus onClick={close}>
            {t("common.cancel")}
          </Button>
          <Button
            variant="danger"
            onClick={() => {
              close();
              void run(items.map((i) => ({ itemId: i.id, action: "uninstall" as const, deleteData })));
            }}
          >
            <Trash2 aria-hidden className="size-4" />
            {many ? t("dialogs.uninstallN", { count: items.length }) : t("dialogs.uninstall")}
          </Button>
        </>
      }
    >
      <ul className="divide-y divide-border rounded-md border border-border">
        {items.map((i) => (
          <li key={i.id} className="flex gap-3 px-3 py-2.5">
            <KindIcon kind={i.kind} className="mt-0.5 size-4" />
            <div className="min-w-0">
              <div className="text-[13px] font-medium">
                {i.name} <span className="font-normal text-muted">· {sourceLabel[i.source]}</span>
              </div>
              <p className="text-xs text-muted">{uninstallEffect(i)}</p>
            </div>
          </li>
        ))}
      </ul>
      {withData.length > 0 && (
        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            checked={deleteData}
            onChange={(e) => setDeleteData(e.target.checked)}
            className="mt-0.5 size-4 accent-[var(--accent)]"
          />
          <span>
            <span className="block text-[13px] font-semibold">{t("dialogs.deleteData", { size: formatBytes(dataBytes) })}</span>
            <span className="block text-xs text-muted">
              {many ? t("dialogs.dataKept", { count: withData.length }) : t("dialogs.dataKeptOne")} {t("dialogs.dataStays")}
            </span>
          </span>
        </label>
      )}
      {items.some((i) => i.kind === "plugin") && <p className="mt-3 text-xs text-muted">{t("dialogs.restart")}</p>}
    </Modal>
  );
}

function CommandDialog({ job }: { job: Job }) {
  const t = useT();
  const confirm = useStore((s) => s.confirm);
  const run = useStore((s) => s.run);
  const close = () => confirm(null);
  return (
    <Modal
      wide
      title={t("dialogs.commandTitle", { name: job.itemName })}
      onClose={close}
      footer={
        <>
          <Button data-autofocus onClick={close}>
            {t("dialogs.dontRun")}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              close();
              void run([{ itemId: job.itemId, action: job.action, acceptCommand: job.confirm?.sha256 }]);
            }}
          >
            {t("dialogs.runCommand")}
          </Button>
        </>
      }
    >
      <div className="mb-3 flex gap-2 rounded-md border border-warn/35 bg-warn/10 px-3 py-2 text-[13px]">
        <TriangleAlert aria-hidden className="mt-0.5 size-4 shrink-0 text-warn" />
        <span>{t("dialogs.commandWarning")}</span>
      </div>
      <pre className="max-h-72 overflow-auto rounded-md border border-border bg-bg p-3 font-mono text-xs whitespace-pre-wrap">
        {job.confirm?.command}
      </pre>
      <p className="mt-2 font-mono text-[11px] break-all text-muted">sha256 {job.confirm?.sha256}</p>
    </Modal>
  );
}

export function ConfirmDialogs() {
  const confirmation = useStore((s) => s.confirmation);
  if (!confirmation) return null;
  switch (confirmation.type) {
    case "update":
      return <ReviewSheet key={confirmation.items.map((i) => i.id).join("\n")} items={confirmation.items} />;
    case "uninstall":
      return <UninstallDialog items={confirmation.items} />;
    case "install":
      return <InstallDialog entry={confirmation.entry} />;
    case "command":
      return <CommandDialog job={confirmation.job} />;
  }
}
