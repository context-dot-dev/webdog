"use client";

import Link from "next/link";
import { Fragment, useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Alert } from "@/lib/db/schema";
import { KindBadge } from "./target-kind";
import { parseTimestamp } from "@/lib/parse-timestamp";
import { RelativeTime } from "./relative-time";
import {
  buildPreviewRows,
  buildTokenDiffs,
  packSegs,
  parseDiff,
  type DiffLine,
  type TokenDiffSeg,
} from "@/lib/diff-display";

interface AlertDetails {
  added?: string[];
  removed?: string[];
  pageUrl?: string;
  aiChangeSummary?: string;
  diffPreview?: string;
  totalAdded?: number;
  totalRemoved?: number;
  productName?: string;
  previousPrice?: number | null;
  previousCurrency?: string | null;
  newPrice?: number | null;
  newCurrency?: string | null;
}

export function AlertItem({
  alert,
  highlighted,
  scrollToDiff,
  website,
  titleLabel,
  attribution,
  readOnly,
}: {
  alert: Alert;
  highlighted?: boolean;
  /** Deep-link hint (e.g. `?diff=1` on `/dashboard/alerts`): scroll expanded diff into view. */
  scrollToDiff?: boolean;
  /** When set (e.g. global alerts page), include site in the one-line summary row. */
  website?: { id: string; name: string; domain: string };
  /** Stripped alert title for display (from server `alertTitleForDisplay`). */
  titleLabel?: string;
  /** Optional deployment attribution shown in the expanded footer. */
  attribution?: string | null;
  /** Public/view-only: expand to read the diff, but never mark read or hit the API. */
  readOnly?: boolean;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(highlighted ?? false);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState(alert.read);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    setRead(alert.read);
  }, [alert.read]);

  useEffect(() => {
    if (!highlighted || !ref.current) return;
    if (scrollToDiff && expanded) {
      const id = window.setTimeout(() => {
        const anchor = document.getElementById(`alert-diff-${alert.id}`);
        if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "nearest" });
        else ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      }, 0);
      return () => clearTimeout(id);
    }
    ref.current.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlighted, scrollToDiff, expanded, alert.id]);

  const details = safeParse(alert.details);
  const mag = changeMagnitude(details);

  async function markRead() {
    if (read || readOnly) return;
    setBusy(true);
    const res = await fetch(`/api/alerts/${alert.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ read: true }),
    });
    setBusy(false);
    if (res.ok) {
      setRead(true);
      router.refresh();
    }
  }

  const showUnread = !read && !readOnly;
  const shellCls = [
    "transition-colors",
    highlighted ? "ring-1 ring-inset ring-neutral-950/10" : "",
    showUnread ? "bg-white shadow-[inset_3px_0_0_0_theme(colors.brand.500)]" : "bg-white",
    "hover:bg-neutral-950/[0.02]",
  ].join(" ");

  const rowPx = "px-4 sm:px-5";

  return (
    <li
      ref={ref as React.RefObject<HTMLLIElement>}
      className={shellCls}
    >
      <div
        className={`flex min-w-0 cursor-pointer items-center gap-2 py-2.5 ${rowPx}`}
        onClick={() => {
          setExpanded((v) => !v);
          void markRead();
        }}
      >
        <span className="shrink-0" aria-hidden>
          <span className={`block rounded-full ${showUnread ? "size-2 bg-brand-500" : "size-1.5 bg-neutral-300"}`} />
        </span>
        {website && (
          <Link
            href={`/dashboard/websites/${website.id}`}
            onClick={(e) => e.stopPropagation()}
            className="hidden max-w-[18rem] shrink-0 truncate text-xs tabular-nums text-neutral-500 underline-offset-4 hover:text-brand-700 hover:underline focus-visible:text-brand-700 sm:inline"
          >
            <span className="font-medium text-neutral-600">{website.name}</span>
            <span className="text-neutral-400" aria-hidden>
              {" · "}
            </span>
            <span className="font-mono text-neutral-500">{website.domain}</span>
          </Link>
        )}
        {website && (
          <Link
            href={`/dashboard/websites/${website.id}`}
            onClick={(e) => e.stopPropagation()}
            className="max-w-[5.5rem] shrink-0 truncate font-mono text-[0.6875rem] text-neutral-500 underline-offset-4 hover:text-brand-700 hover:underline sm:hidden"
          >
            {website.domain}
          </Link>
        )}
        <KindBadge kind={alert.kind} compact />
        <p className="min-w-0 flex-1 truncate text-sm text-neutral-900">
          {titleLabel ?? alert.title.replace(/https?:\/\//g, "")}
        </p>
        {(mag.added > 0 || mag.removed > 0) && (
          <span className="hidden shrink-0 items-center gap-1.5 tabular-nums sm:inline-flex">
            {mag.added > 0 && (
              <span className="text-[0.6875rem] font-semibold text-emerald-600">+{mag.added}</span>
            )}
            {mag.removed > 0 && (
              <span className="text-[0.6875rem] font-semibold text-rose-500">−{mag.removed}</span>
            )}
          </span>
        )}
        <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-neutral-500">
          <RelativeTime date={parseTimestamp(alert.createdAt)} />
        </span>
        <button
          type="button"
          className="btn-ghost shrink-0 px-2 py-1 text-[0.6875rem] font-medium tabular-nums"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
            void markRead();
          }}
          disabled={busy}
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      {expanded && (
        <div className={`border-t border-neutral-950/[0.05] pb-4 pt-3 ${rowPx}`}>
          <DetailsView details={details} diffAnchorAlertId={alert.id} attribution={attribution} />
        </div>
      )}
    </li>
  );
}

function DetailsView({
  details,
  diffAnchorAlertId,
  attribution,
}: {
  details: AlertDetails;
  diffAnchorAlertId?: string;
  attribution?: string | null;
}) {
  const diffAnchor = diffAnchorAlertId ? `alert-diff-${diffAnchorAlertId}` : undefined;
  return (
    <div className="mt-3 space-y-4 text-sm">
      {details.aiChangeSummary?.trim() && (
        <div className="rounded-xl bg-gradient-to-br from-brand-50 to-white p-3.5 ring-1 ring-brand-500/15">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-800">
            <SparkleIcon className="size-3.5" />
            Summary of changes
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-neutral-800">
            {details.aiChangeSummary.trim()}
          </p>
        </div>
      )}
      {details.added && details.added.length > 0 && (
        <LinksBlock title="Added" tone="emerald" urls={details.added} />
      )}
      {details.removed && details.removed.length > 0 && (
        <LinksBlock title="Removed" tone="rose" urls={details.removed} />
      )}
      {details.pageUrl && (
        <a
          href={details.pageUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="inline-flex max-w-full items-center gap-1.5 rounded-lg bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-600 ring-1 ring-neutral-950/5 transition hover:text-brand-700 hover:ring-brand-500/30"
        >
          <LinkIcon className="size-3.5 shrink-0 text-neutral-400" />
          <span className="truncate font-mono">{details.pageUrl.replace(/^https?:\/\//, "")}</span>
        </a>
      )}
      {details.newPrice !== undefined && (
        <PriceChangeDetails
          productName={details.productName}
          previousPrice={details.previousPrice}
          previousCurrency={details.previousCurrency}
          newPrice={details.newPrice}
          newCurrency={details.newCurrency}
        />
      )}
      {details.diffPreview && (
        <div id={diffAnchor}>
          <DiffPreview
            raw={details.diffPreview}
            totalAdded={details.totalAdded}
            totalRemoved={details.totalRemoved}
          />
        </div>
      )}
      {attribution?.trim() && (
        <p className="border-t border-neutral-950/5 pt-3 text-xs leading-relaxed text-neutral-400">
          <AttributionText text={attribution.trim()} />
        </p>
      )}
    </div>
  );
}

function AttributionText({ text }: { text: string }) {
  const parts = text.split("Context.dev");
  if (parts.length === 1) return <>{text}</>;
  return (
    <>
      {parts.map((part, i) => (
        <Fragment key={i}>
          {part}
          {i < parts.length - 1 && (
            <a
              href="https://context.dev"
              target="_blank"
              rel="noreferrer noopener"
              className="text-neutral-500 underline-offset-2 hover:text-brand-700 hover:underline"
            >
              Context.dev
            </a>
          )}
        </Fragment>
      ))}
    </>
  );
}

export function DiffPreview({
  raw,
  totalAdded,
  totalRemoved,
}: {
  raw: string;
  totalAdded?: number;
  totalRemoved?: number;
}) {
  const lines = parseDiff(raw);
  const added = totalAdded ?? lines.filter((l) => l.kind === "add").length;
  const removed = totalRemoved ?? lines.filter((l) => l.kind === "del").length;
  const rows = buildPreviewRows(lines);

  return (
    <div className="overflow-hidden rounded-xl ring-1 ring-neutral-950/[0.08] shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-950/5 bg-neutral-50/80 px-3 py-2">
        <p className="text-xs font-semibold text-neutral-700">What changed</p>
        <div className="flex items-center gap-1.5 tabular-nums">
          {added > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-emerald-700 ring-1 ring-emerald-600/15 ring-inset">
              <span aria-hidden>＋</span>
              {added} added
            </span>
          )}
          {removed > 0 && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-rose-50 px-2 py-0.5 text-[0.6875rem] font-semibold text-rose-700 ring-1 ring-rose-600/15 ring-inset">
              <span aria-hidden>－</span>
              {removed} removed
            </span>
          )}
        </div>
      </div>
      <div className="max-h-72 overflow-auto bg-white">
        <table className="w-full border-collapse font-mono text-xs">
          <tbody>
            {rows.map((row, i) =>
              row.type === "pair" ? <DiffPairedRow key={i} oldText={row.old} newText={row.new} /> : <DiffRow key={i} line={row.line} />,
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DiffPairedRow({ oldText, newText }: { oldText: string; newText: string }) {
  const { del, add } = buildTokenDiffs(oldText, newText);
  const delPacked = packSegs(del);
  const addPacked = packSegs(add);
  return (
    <>
      <DiffRowWithSegs
        sign="−"
        rowClass="bg-rose-50/60"
        gutterClass="bg-rose-100/80 text-rose-700"
        textClass="text-rose-900"
        highlightClass="bg-rose-200/80 text-rose-950"
        segs={delPacked}
        emptyFiller
      />
      <DiffRowWithSegs
        sign="+"
        rowClass="bg-emerald-50/60"
        gutterClass="bg-emerald-100/80 text-emerald-700"
        textClass="text-emerald-900"
        highlightClass="bg-emerald-200/80 text-emerald-950"
        segs={addPacked}
        emptyFiller
      />
    </>
  );
}

function DiffRowWithSegs({
  sign,
  rowClass,
  gutterClass,
  textClass,
  highlightClass,
  segs,
  emptyFiller,
}: {
  sign: string;
  rowClass: string;
  gutterClass: string;
  textClass: string;
  highlightClass: string;
  segs: TokenDiffSeg[];
  /** Show nbsp on empty line for layout parity with the paired row */
  emptyFiller?: boolean;
}) {
  return (
    <tr className={rowClass}>
      <td
        aria-hidden
        className={`w-6 border-r border-neutral-950/5 px-2 text-center font-semibold select-none ${gutterClass}`}
      >
        {sign}
      </td>
      <td className={`px-3 py-1 break-all whitespace-pre-wrap ${textClass}`}>
        {segs.length === 0 && emptyFiller ? "\u00A0" : null}
        {segs.map((s, j) =>
          s.change ? (
            <mark key={j} className={`rounded-sm px-0.5 [box-decoration-break:clone] ${highlightClass}`}>
              {s.text}
            </mark>
          ) : (
            <span key={j}>{s.text}</span>
          ),
        )}
      </td>
    </tr>
  );
}

function DiffRow({ line }: { line: DiffLine }) {
  const tone =
    line.kind === "add"
      ? { row: "bg-emerald-50/60", gutter: "bg-emerald-100/80 text-emerald-700", text: "text-emerald-900", sign: "+" }
      : line.kind === "del"
        ? { row: "bg-rose-50/60", gutter: "bg-rose-100/80 text-rose-700", text: "text-rose-900", sign: "−" }
        : { row: "bg-white", gutter: "bg-neutral-50 text-neutral-400", text: "text-neutral-700", sign: " " };

  return (
    <tr className={tone.row}>
      <td
        aria-hidden
        className={`w-6 border-r border-neutral-950/5 px-2 text-center font-semibold select-none ${tone.gutter}`}
      >
        {tone.sign}
      </td>
      <td className={`px-3 py-1 break-all whitespace-pre-wrap ${tone.text}`}>
        {line.text || "\u00A0"}
      </td>
    </tr>
  );
}

export function LinksBlock({ title, urls, tone }: { title: string; urls: string[]; tone: "emerald" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-700" : "text-rose-700";
  return (
    <div>
      <div className={`text-xs font-medium ${color}`}>{title}</div>
      <ul role="list" className="mt-1 space-y-1">
        {urls.slice(0, 10).map((u) => (
          <li key={u} className="truncate font-mono text-xs">
            <a href={u} target="_blank" rel="noreferrer noopener" className="text-neutral-700 hover:text-brand-700 hover:underline">
              {u}
            </a>
          </li>
        ))}
        {urls.length > 10 && (
          <li className="text-xs text-neutral-500">+ {urls.length - 10} more</li>
        )}
      </ul>
    </div>
  );
}

function formatMoney(price: number | null | undefined, currency: string | null | undefined): string {
  if (price === null || price === undefined) return "—";
  const c = currency?.trim();
  if (c) return `${c} ${price}`;
  return String(price);
}

export function PriceChangeDetails({
  productName,
  previousPrice,
  previousCurrency,
  newPrice,
  newCurrency,
}: {
  productName?: string;
  previousPrice?: number | null;
  previousCurrency?: string | null;
  newPrice?: number | null;
  newCurrency?: string | null;
}) {
  return (
    <div className="rounded-xl bg-amber-50/80 px-3 py-2 ring-1 ring-amber-600/15">
      {productName && <div className="text-sm font-medium text-neutral-900">{productName}</div>}
      <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm tabular-nums">
        <span className="text-neutral-600">
          Was <span className="text-neutral-900">{formatMoney(previousPrice, previousCurrency)}</span>
        </span>
        <span className="text-neutral-400">→</span>
        <span className="text-neutral-600">
          Now <span className="font-medium text-amber-900">{formatMoney(newPrice, newCurrency)}</span>
        </span>
      </div>
    </div>
  );
}

function changeMagnitude(d: AlertDetails): { added: number; removed: number } {
  return {
    added: d.totalAdded ?? d.added?.length ?? 0,
    removed: d.totalRemoved ?? d.removed?.length ?? 0,
  };
}

function SparkleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden {...props}>
      <path d="M8 1.5c.28 0 .53.18.62.45l.86 2.57 2.57.86a.66.66 0 0 1 0 1.24l-2.57.86-.86 2.57a.66.66 0 0 1-1.24 0l-.86-2.57-2.57-.86a.66.66 0 0 1 0-1.24l2.57-.86.86-2.57A.66.66 0 0 1 8 1.5Z" />
      <path d="M12.75 9.5c.19 0 .36.12.42.3l.5 1.48 1.48.5a.44.44 0 0 1 0 .84l-1.48.5-.5 1.48a.44.44 0 0 1-.84 0l-.5-1.48-1.48-.5a.44.44 0 0 1 0-.84l1.48-.5.5-1.48a.44.44 0 0 1 .42-.3Z" />
    </svg>
  );
}

function LinkIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden {...props}>
      <path d="M6.5 9.5a2.5 2.5 0 0 0 3.54 0l2-2a2.5 2.5 0 0 0-3.54-3.54l-.5.5" />
      <path d="M9.5 6.5a2.5 2.5 0 0 0-3.54 0l-2 2a2.5 2.5 0 0 0 3.54 3.54l.5-.5" />
    </svg>
  );
}

function safeParse(json: string): AlertDetails {
  try {
    return JSON.parse(json) as AlertDetails;
  } catch {
    return {};
  }
}
