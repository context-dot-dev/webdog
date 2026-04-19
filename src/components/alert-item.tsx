"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Alert } from "@/lib/db/schema";
import { KindBadge } from "./target-kind";
import { RelativeTime } from "./relative-time";

interface AlertDetails {
  added?: string[];
  removed?: string[];
  pageUrl?: string;
  diffPreview?: string;
}

export function AlertItem({ alert }: { alert: Alert }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [read, setRead] = useState(alert.read);

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

  return (
    <li
      className={`px-5 py-4 transition ${read ? "bg-white" : "bg-brand-50/40"}`}
      onClick={() => {
        setExpanded((v) => !v);
        void markRead();
      }}
    >
      <div className="flex cursor-pointer items-start gap-3">
        <span className="mt-1 block size-2 shrink-0 rounded-full" aria-hidden>
          <span className={`block size-2 rounded-full ${read ? "bg-neutral-300" : "bg-brand-500"}`} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <KindBadge kind={alert.kind} />
            <p className="text-sm font-medium text-neutral-900">{alert.title}</p>
          </div>
          <div className="mt-0.5 text-xs text-neutral-500">
            <RelativeTime date={new Date(Number(alert.createdAt))} />
          </div>
          {expanded && <DetailsView details={details} />}
        </div>
        <button
          type="button"
          className="btn-ghost text-xs px-2 py-1"
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
    </li>
  );
}

function DetailsView({ details }: { details: AlertDetails }) {
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
      {details.diffPreview && <DiffPreview raw={details.diffPreview} />}
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

function DiffPreview({ raw }: { raw: string }) {
  const lines = parseDiff(raw);
  const added = lines.filter((l) => l.kind === "add").length;
  const removed = lines.filter((l) => l.kind === "del").length;

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
            {lines.map((line, i) => (
              <DiffRow key={i} line={line} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
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

function LinksBlock({ title, urls, tone }: { title: string; urls: string[]; tone: "emerald" | "rose" }) {
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

function safeParse(json: string): AlertDetails {
  try {
    return JSON.parse(json) as AlertDetails;
  } catch {
    return {};
  }
}
