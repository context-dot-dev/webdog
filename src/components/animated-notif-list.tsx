"use client";

import { useEffect, useRef, useState } from "react";

export type NotifItem = {
  id: string;
  domain: string;
  /** Override domain used for brand-logo lookup (e.g. "ycombinator.com" for HN). */
  logoDomain?: string;
  site: string;
  message: string;
  time: string;
  accentColor: string;
  /** Background colour for the logo circle. Defaults to white. */
  bgColor?: string;
  logoUrl: string | null;
};

type QueueEntry = NotifItem & { uid: number };

const MAX_VISIBLE = 5;

export function AnimatedNotifList({
  items,
  className,
}: {
  items: NotifItem[];
  className?: string;
}) {
  const [queue, setQueue] = useState<QueueEntry[]>(() =>
    items.slice(0, MAX_VISIBLE).map((item, i) => ({ ...item, uid: i })),
  );
  const uidRef = useRef(items.length);
  const idxRef = useRef(MAX_VISIBLE % items.length);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => {
      const next = items[idxRef.current % items.length];
      const uid = uidRef.current++;
      idxRef.current++;
      setQueue((q) => [{ ...next, uid }, ...q].slice(0, MAX_VISIBLE));
    }, 2200);
    return () => clearInterval(id);
  }, [items]);

  return (
    <div className={`relative flex h-[460px] flex-col gap-3 overflow-hidden p-2 ${className ?? ""}`}>
      {queue.map((entry, i) => (
        <NotifCard key={entry.uid} item={entry} isNew={i === 0} />
      ))}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-cream-100 to-transparent" />
    </div>
  );
}

function NotifCard({ item, isNew }: { item: NotifItem; isNew: boolean }) {
  return (
    <figure
      className={`relative w-full cursor-default overflow-hidden rounded-2xl bg-white p-4 shadow-notif transition-all duration-300 hover:scale-[1.015] ${
        isNew ? "animate-slide-in" : ""
      }`}
    >
      <div className="flex flex-row items-center gap-3">
        {/* Per-brand coloured circle — no ring when bg is non-white */}
        <div
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full"
          style={{ background: item.bgColor ?? "#ffffff", boxShadow: "0 0 0 1px rgba(0,0,0,0.08)" }}
        >
          {item.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.logoUrl} alt="" className="size-6 object-contain" loading="lazy" />
          ) : (
            <span
              className="text-sm font-bold"
              style={{ color: item.bgColor && item.bgColor !== "#ffffff" ? "#ffffff" : item.accentColor }}
            >
              {item.site[0].toUpperCase()}
            </span>
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <figcaption className="flex items-center gap-1.5 text-sm font-semibold text-neutral-900">
            <span className="truncate">{item.site}</span>
            <span className="text-neutral-300">·</span>
            <span className="shrink-0 text-xs font-normal text-neutral-400">{item.time}</span>
          </figcaption>
          <p className="truncate text-sm text-neutral-500">{item.message}</p>
        </div>

        {/* Live pulse dot */}
        <span className="relative ml-1 flex size-2 shrink-0">
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
        </span>
      </div>
    </figure>
  );
}
