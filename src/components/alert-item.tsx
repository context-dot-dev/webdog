"use client";

import Link from "next/link";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import type { Alert } from "@/lib/db/schema";
import { KindBadge } from "./target-kind";
import { RelativeTime } from "./relative-time";

interface AlertDetails {
  added?: string[];
  removed?: string[];
  pageUrl?: string;
  diffPreview?: string;
  totalAdded?: number;
  totalRemoved?: number;
  productName?: string;
  previousPrice?: number | null;
  previousCurrency?: string | null;
  newPrice?: number | null;
  newCurrency?: string | null;
}

function alertTitleForDisplay(title: string): string {
  return title.replace(/https?:\/\//g, "");
}

export function AlertItem({
  alert,
  highlighted,
  scrollToDiff,
  website,
}: {
  alert: Alert;
  highlighted?: boolean;
  /** Deep-link hint (e.g. `?diff=1` on `/dashboard/alerts`): scroll expanded diff into view. */
  scrollToDiff?: boolean;
  /** When set (e.g. global alerts page), include site in the one-line summary row. */
  website?: { id: string; name: string; domain: string };
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

  async function markRead() {
    if (read) return;
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

  const shellCls = [
    "transition-colors",
    highlighted ? "ring-1 ring-inset ring-neutral-950/10" : "",
    read ? "bg-white" : "bg-white shadow-[inset_3px_0_0_0_theme(colors.brand.500)]",
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
          <span className={`block rounded-full ${read ? "size-1.5 bg-neutral-300" : "size-2 bg-brand-500"}`} />
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
        <p className="min-w-0 flex-1 truncate text-sm text-neutral-900">{alertTitleForDisplay(alert.title)}</p>
        <span className="shrink-0 whitespace-nowrap text-xs tabular-nums text-neutral-500">
          <RelativeTime date={new Date(Number(alert.createdAt))} />
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
          <DetailsView details={details} diffAnchorAlertId={alert.id} />
        </div>
      )}
    </li>
  );
}

function DetailsView({
  details,
  diffAnchorAlertId,
}: {
  details: AlertDetails;
  diffAnchorAlertId?: string;
}) {
  const diffAnchor = diffAnchorAlertId ? `alert-diff-${diffAnchorAlertId}` : undefined;
  return (
    <div className="mt-3 space-y-3 text-sm">
      {details.added && details.added.length > 0 && (
        <LinksBlock title="Added" tone="emerald" urls={details.added} />
      )}
      {details.removed && details.removed.length > 0 && (
        <LinksBlock title="Removed" tone="rose" urls={details.removed} />
      )}
      {details.pageUrl && (
        <div>
          <div className="text-xs font-medium text-neutral-700">Page</div>
          <a
            href={details.pageUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="block truncate font-mono text-xs text-brand-700 hover:underline"
          >
            {details.pageUrl}
          </a>
        </div>
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
    </div>
  );
}

type DiffLine =
  | { kind: "add"; text: string }
  | { kind: "del"; text: string }
  | { kind: "ctx"; text: string };

function parseDiff(raw: string): DiffLine[] {
  return raw.split("\n").map((line) => {
    if (line.startsWith("+ ") || line === "+") return { kind: "add", text: line.slice(2) };
    if (line.startsWith("- ") || line === "-") return { kind: "del", text: line.slice(2) };
    return { kind: "ctx", text: line };
  });
}

/** Splits a line into words and whitespace (preserves rendering). */
function tokenizeForDiff(s: string): string[] {
  if (!s) return [];
  return s.match(/\S+|\s+/g) ?? [];
}

type TokenDiffSeg = { text: string; change: boolean };

/**
 * Pairs the k-th add line with the k-th remove line (backend emits all + lines, then all − lines)
 * and marks tokens that differ on each side.
 */
function buildTokenDiffs(oldText: string, newText: string): { del: TokenDiffSeg[]; add: TokenDiffSeg[] } {
  const a = tokenizeForDiff(oldText);
  const b = tokenizeForDiff(newText);
  const n = a.length;
  const m = b.length;
  const dp: number[][] = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }
  type Step = { kind: "eq" | "del" | "ins"; i: number; j: number };
  const steps: Step[] = [];
  let i = n;
  let j = m;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      steps.push({ kind: "eq", i: i - 1, j: j - 1 });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      steps.push({ kind: "ins", i: -1, j: j - 1 });
      j--;
    } else {
      steps.push({ kind: "del", i: i - 1, j: -1 });
      i--;
    }
  }
  steps.reverse();

  const del: TokenDiffSeg[] = [];
  const add: TokenDiffSeg[] = [];
  for (const s of steps) {
    if (s.kind === "eq") {
      const t = a[s.i];
      del.push({ text: t, change: false });
      add.push({ text: t, change: false });
    } else if (s.kind === "del") {
      del.push({ text: a[s.i], change: true });
    } else {
      add.push({ text: b[s.j], change: true });
    }
  }
  return { del, add };
}

/**
 * Packs adjacent segments with the same change flag to reduce DOM noise.
 */
function packSegs(segs: TokenDiffSeg[]): TokenDiffSeg[] {
  const out: TokenDiffSeg[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.change === s.change) last.text += s.text;
    else out.push({ text: s.text, change: s.change });
  }
  return out;
}

type PreviewRow = { type: "pair"; old: string; new: string } | { type: "single"; line: DiffLine };

function buildPreviewRows(lines: DiffLine[]): PreviewRow[] {
  const adds = lines.filter((l): l is Extract<DiffLine, { kind: "add" }> => l.kind === "add");
  const dels = lines.filter((l): l is Extract<DiffLine, { kind: "del" }> => l.kind === "del");
  const ctx = lines.filter((l) => l.kind === "ctx");
  const k = Math.min(adds.length, dels.length);
  const rows: PreviewRow[] = [];
  for (const l of ctx) rows.push({ type: "single", line: l });
  for (let i = 0; i < k; i++) rows.push({ type: "pair", old: dels[i].text, new: adds[i].text });
  for (let i = k; i < adds.length; i++) rows.push({ type: "single", line: { kind: "add", text: adds[i].text } });
  for (let i = k; i < dels.length; i++) rows.push({ type: "single", line: { kind: "del", text: dels[i].text } });
  return rows;
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
    <div className="overflow-hidden rounded-xl ring-1 ring-neutral-950/10 shadow-xs">
      <div className="flex items-center justify-between gap-3 border-b border-neutral-950/5 bg-neutral-50 px-3 py-2">
        <div className="flex items-center gap-2">
          <svg viewBox="0 0 16 16" aria-hidden className="size-3.5 text-neutral-400">
            <path fill="currentColor" d="M4.177 7.823a.75.75 0 0 1 1.06 0L8 10.586l2.763-2.763a.75.75 0 1 1 1.06 1.06L8.53 12.177a.75.75 0 0 1-1.06 0L4.177 8.884a.75.75 0 0 1 0-1.06Z" />
            <path fill="currentColor" d="M8 1.5A6.5 6.5 0 1 0 14.5 8H13a5 5 0 1 1-5-5V1.5Z" />
          </svg>
          <p className="text-xs font-medium text-neutral-700">Diff preview</p>
        </div>
        <div className="flex items-center gap-1.5 tabular-nums">
          {added > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 py-0.5 pr-1.5 pl-1 text-[0.6875rem] font-semibold text-emerald-700 ring-1 ring-emerald-600/20 ring-inset">
              <span aria-hidden>＋</span>
              {added}
            </span>
          )}
          {removed > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-rose-50 py-0.5 pr-1.5 pl-1 text-[0.6875rem] font-semibold text-rose-700 ring-1 ring-rose-600/20 ring-inset">
              <span aria-hidden>－</span>
              {removed}
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

function safeParse(json: string): AlertDetails {
  try {
    return JSON.parse(json) as AlertDetails;
  } catch {
    return {};
  }
}
