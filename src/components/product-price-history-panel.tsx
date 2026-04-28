"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { formatProductPrice, type ProductPricePoint } from "@/lib/product-price-history";

const VIEW_W = 560;
const VIEW_H = 172;
const PAD = { l: 44, r: 12, t: 12, b: 40 };

/** Past this, skip drawing a dot for every point (line only + hover) so dense series stay readable. */
const DOTS_EVERY_WHEN_N_LEQ = 48;

type PlotPoint = {
  id: string;
  createdAt: number;
  price: number;
  currency: string | null;
  x: number;
  y: number;
};

function clientToSvg(svg: SVGSVGElement, clientX: number, clientY: number): { x: number; y: number } | null {
  const ctm = svg.getScreenCTM();
  if (!ctm) return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}

function nearestPlotIndex(svg: SVGSVGElement, clientX: number, clientY: number, points: PlotPoint[]): number {
  if (points.length === 0) return 0;
  const cur = clientToSvg(svg, clientX, clientY);
  if (!cur) return 0;
  let bestI = 0;
  let best = Infinity;
  for (let i = 0; i < points.length; i++) {
    const p = points[i]!;
    const dx = cur.x - p.x;
    const dy = cur.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < best) {
      best = d2;
      bestI = i;
    }
  }
  return bestI;
}

/** For very long series, snap by time (x) first then refine among neighbors to avoid "wrong" y jumps. */
function nearestPlotIndexTolerant(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
  points: PlotPoint[],
  t0: number,
  t1: number,
  innerW: number,
): number {
  if (points.length === 0) return 0;
  if (points.length <= 120) {
    return nearestPlotIndex(svg, clientX, clientY, points);
  }
  const cur = clientToSvg(svg, clientX, clientY);
  if (!cur) return 0;
  if (cur.x < PAD.l || cur.x > PAD.l + innerW) {
    return nearestPlotIndex(svg, clientX, clientY, points);
  }
  const span = t1 - t0 || 1;
  const tAt = t0 + ((cur.x - PAD.l) / innerW) * span;
  let lo = 0;
  let hi = points.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid]!.createdAt < tAt) lo = mid + 1;
    else hi = mid;
  }
  const j = lo;
  const window = 6;
  const from = Math.max(0, j - window);
  const to = Math.min(points.length - 1, j + window);
  let bestI = j;
  let bestD = Infinity;
  for (let i = from; i <= to; i++) {
    const p = points[i]!;
    const dx = cur.x - p.x;
    const dy = cur.y - p.y;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD) {
      bestD = d2;
      bestI = i;
    }
  }
  return bestI;
}

/** Formats x-axis time from span so short ranges show time-of-day; longer ranges show dates. */
function formatAxisDate(ms: number, spanMs: number): string {
  const date = new Date(ms);
  if (spanMs <= 0) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (spanMs < 36 * 60 * 60 * 1000) {
    return date.toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  }
  if (spanMs < 120 * 24 * 60 * 60 * 1000) {
    return date.toLocaleString(undefined, { month: "short", day: "numeric" });
  }
  return date.toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function priceLineLabel(points: { price: number; currency: string | null }[]): string {
  const withCur = points.filter((p) => p.currency?.trim());
  if (withCur.length === 0) return "Price over time (numeric).";
  const c = new Set(withCur.map((p) => p.currency!.trim()));
  if (c.size <= 1) {
    const code = withCur[0]!.currency!.trim();
    return `Price in ${code} over time.`;
  }
  return "Price over time. Multiple currencies: chart uses raw numbers; check the table for each currency.";
}

function formatTooltipWhen(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function csvFilename(pageUrl: string | null | undefined): string {
  if (!pageUrl) return "price-history.csv";
  try {
    const { hostname, pathname } = new URL(pageUrl);
    const slug = (hostname + pathname)
      .replace(/^www\./, "")
      .replace(/\/+$/, "")
      .replace(/[^a-zA-Z0-9._-]/g, "-")
      .replace(/-{2,}/g, "-")
      .slice(0, 80);
    return `price-history-${slug}.csv`;
  } catch {
    return "price-history.csv";
  }
}

function downloadCsv(plottable: PlotPoint[], pageUrl: string | null | undefined) {
  const rows = [["timestamp_iso", "price", "currency"]];
  for (const p of plottable) {
    rows.push([new Date(p.createdAt).toISOString(), String(p.price), p.currency ?? ""]);
  }
  const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = csvFilename(pageUrl);
  a.click();
  URL.revokeObjectURL(url);
}

export function ProductPriceHistoryPanel({ points, pageUrl }: { points: ProductPricePoint[]; pageUrl?: string | null }) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const pending = useRef<{ clientX: number; clientY: number } | null>(null);
  const rafMove = useRef<number | null>(null);

  const plottable = useMemo(
    () => points.filter((p) => p.isProductPage && p.price !== null && p.price !== undefined),
    [points],
  );

  const pathD = useMemo(() => {
    if (plottable.length < 1) return null;
    const innerW = VIEW_W - PAD.l - PAD.r;
    const innerH = VIEW_H - PAD.t - PAD.b;
    const t0 = plottable[0]!.createdAt;
    const t1 = plottable[plottable.length - 1]!.createdAt;
    const times = t1 - t0 || 1;
    const prices = plottable.map((p) => p.price!);
    let yMin = Math.min(...prices);
    let yMax = Math.max(...prices);
    if (yMin === yMax) {
      yMin -= 1;
      yMax += 1;
    }
    const padY = (yMax - yMin) * 0.06;
    yMin -= padY;
    yMax += padY;
    const yR = yMax - yMin || 1;

    const toX = (t: number) => PAD.l + ((t - t0) / times) * innerW;
    const toY = (v: number) => PAD.t + innerH - ((v - yMin) / yR) * innerH;

    const cmds: string[] = [];
    const plotPoints: PlotPoint[] = [];
    for (let i = 0; i < plottable.length; i++) {
      const p = plottable[i]!;
      const x = toX(p.createdAt);
      const y = toY(p.price!);
      cmds.push(i === 0 ? `M ${x} ${y}` : `L ${x} ${y}`);
      plotPoints.push({
        id: p.id,
        createdAt: p.createdAt,
        price: p.price!,
        currency: p.currency,
        x,
        y,
      });
    }

    const span = t1 - t0 || 0;
    let tickTimes: number[];
    if (plottable.length === 1) {
      tickTimes = [t0];
    } else {
      const nTicks = Math.max(2, Math.min(5, Math.floor(innerW / 70)));
      tickTimes = Array.from({ length: nTicks }, (_, i) => t0 + (span * i) / (nTicks - 1));
    }
    const xLabels = tickTimes.map((t, i) => {
      if (tickTimes.length === 1) {
        return {
          x: PAD.l + innerW / 2,
          label: formatAxisDate(t, span),
          anchor: "middle" as const,
        };
      }
      const xPlot = toX(t);
      if (i === 0) {
        return { x: PAD.l + 2, label: formatAxisDate(t, span), anchor: "start" as const };
      }
      if (i === tickTimes.length - 1) {
        return { x: PAD.l + innerW - 2, label: formatAxisDate(t, span), anchor: "end" as const };
      }
      return { x: xPlot, label: formatAxisDate(t, span), anchor: "middle" as const };
    });

    return { d: cmds.join(" "), yMin, yMax, t0, t1, innerW, innerH, xLabels, plotPoints };
  }, [plottable]);

  const chartHelp = plottable.length
    ? priceLineLabel(
        plottable.map((p) => ({ price: p.price!, currency: p.currency })),
      )
    : "No plottable price yet (extraction or product page flag).";

  const scheduleHover = useCallback(
    (clientX: number, clientY: number) => {
      pending.current = { clientX, clientY };
      if (rafMove.current != null) return;
      rafMove.current = requestAnimationFrame(() => {
        rafMove.current = null;
        const p = pending.current;
        const svg = svgRef.current;
        const chart = pathD;
        if (!p || !svg || !chart) return;
        const idx = nearestPlotIndexTolerant(
          svg,
          p.clientX,
          p.clientY,
          chart.plotPoints,
          chart.t0,
          chart.t1,
          chart.innerW,
        );
        setHoverIndex(idx);
      });
    },
    [pathD],
  );

  const showAllDots = pathD ? pathD.plotPoints.length <= DOTS_EVERY_WHEN_N_LEQ : false;
  const dense = pathD ? pathD.plotPoints.length > DOTS_EVERY_WHEN_N_LEQ : false;

  if (points.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-neutral-200 bg-white/50 px-4 py-6 text-center text-sm text-neutral-500">
        No product snapshots yet. The chart appears after the worker stores at least one product fetch.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-xs font-medium text-neutral-800">Price history</h3>
          <p className="mt-0.5 text-xs text-neutral-500">{chartHelp}</p>
          {dense && (
            <p className="mt-1 text-xs text-neutral-500">
              Dense history: point markers are hidden; move the pointer over the chart to read date and price.
            </p>
          )}
          {plottable.length < 2 && !dense && (
            <p className="mt-1 text-xs text-amber-800/90">
              Add more checks over time to see a line; a single data point only shows a dot.
            </p>
          )}
        </div>
        {plottable.length > 0 && pathD && (
          <button
            type="button"
            onClick={() => downloadCsv(pathD.plotPoints, pageUrl)}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-neutral-200 bg-white px-2.5 py-1 text-xs font-medium text-neutral-600 shadow-sm transition hover:bg-neutral-50 hover:text-neutral-900 active:bg-neutral-100"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="size-3.5"
              viewBox="0 0 20 20"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
            CSV
          </button>
        )}
      </div>

      {plottable.length > 0 && pathD && (
        <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-neutral-950/10">
          <svg
            ref={svgRef}
            className="w-full min-w-[18rem] cursor-crosshair text-brand-600"
            viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
            role="img"
            aria-label="Line chart of observed price over time; hover for values"
          >
            <rect x="0" y="0" width={VIEW_W} height={VIEW_H} className="fill-white" />
            <line
              x1={PAD.l}
              y1={VIEW_H - PAD.b + 2}
              x2={VIEW_W - PAD.r}
              y2={VIEW_H - PAD.b + 2}
              className="stroke-neutral-200"
              strokeWidth={1}
            />
            {pathD.xLabels.map((lab) => (
              <text
                key={`${lab.x}-${lab.label}`}
                x={lab.x}
                y={VIEW_H - 8}
                className="fill-neutral-500 [font-size:8.5px]"
                textAnchor={lab.anchor}
              >
                {lab.label}
              </text>
            ))}
            {/* y-axis tick labels (min / max) */}
            <text
              x={PAD.l - 4}
              y={PAD.t + 8}
              className="fill-neutral-500 text-[9px]"
              textAnchor="end"
            >
              {pathD.yMax.toFixed(0)}
            </text>
            <text
              x={PAD.l - 4}
              y={VIEW_H - PAD.b}
              className="fill-neutral-500 text-[9px]"
              textAnchor="end"
            >
              {pathD.yMin.toFixed(0)}
            </text>
            <path
              d={pathD.d}
              className="fill-none stroke-[2] stroke-current"
              strokeLinecap="round"
              strokeLinejoin="round"
              pointerEvents="none"
            />
            {showAllDots &&
              pathD.plotPoints.map((p) => (
                <circle key={p.id} cx={p.x} cy={p.y} r={3.5} className="fill-current" pointerEvents="none" />
              ))}

            <rect
              x={PAD.l}
              y={PAD.t}
              width={pathD.innerW}
              height={pathD.innerH}
              className="fill-transparent"
              onMouseMove={(e) => scheduleHover(e.clientX, e.clientY)}
              onMouseLeave={() => {
                setHoverIndex(null);
              }}
              onTouchStart={(e) => {
                const t = e.touches[0];
                if (t) scheduleHover(t.clientX, t.clientY);
              }}
              onTouchMove={(e) => {
                const t = e.touches[0];
                if (t) scheduleHover(t.clientX, t.clientY);
              }}
              onTouchEnd={() => setHoverIndex(null)}
            />

            {hoverIndex != null && pathD.plotPoints[hoverIndex] && (
              <g className="text-brand-600" pointerEvents="none">
                <line
                  x1={pathD.plotPoints[hoverIndex]!.x}
                  y1={PAD.t}
                  x2={pathD.plotPoints[hoverIndex]!.x}
                  y2={PAD.t + pathD.innerH}
                  className="stroke-brand-500/35"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
                <circle
                  cx={pathD.plotPoints[hoverIndex]!.x}
                  cy={pathD.plotPoints[hoverIndex]!.y}
                  r={5}
                  className="fill-white stroke-[2.5] stroke-current"
                />
                {(() => {
                  const pt = pathD.plotPoints[hoverIndex]!;
                  const w = 132;
                  const h = 44;
                  let tx = pt.x + 8;
                  if (tx + w > VIEW_W - PAD.r) tx = pt.x - w - 8;
                  tx = Math.max(PAD.l, Math.min(tx, VIEW_W - PAD.r - w));
                  let ty = pt.y - h - 8;
                  if (ty < PAD.t) ty = pt.y + 8;
                  return (
                    <foreignObject x={tx} y={ty} width={w} height={h}>
                      <div className="flex h-full flex-col justify-center rounded-lg border border-neutral-200 bg-white px-2 py-1.5 text-[0.7rem] shadow-sm">
                        <div className="font-semibold tabular-nums text-neutral-900">
                          {formatProductPrice(pt.price, pt.currency)}
                        </div>
                        <div className="mt-0.5 text-[0.65rem] leading-tight text-neutral-500">
                          {formatTooltipWhen(pt.createdAt)}
                        </div>
                      </div>
                    </foreignObject>
                  );
                })()}
              </g>
            )}
          </svg>
        </div>
      )}

    </div>
  );
}
