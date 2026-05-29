"use client";

import { useEffect, useState } from "react";
import { parseTimestamp } from "@/lib/parse-timestamp";

function fmt(d: Date): string {
  const diff = Date.now() - d.getTime();
  const sec = Math.round(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  return d.toLocaleDateString();
}

export function RelativeTime({ date }: { date: Date | string | number }) {
  const parsed = parseTimestamp(date);
  const valid = !Number.isNaN(parsed.getTime());
  const [label, setLabel] = useState(() => (valid ? fmt(parsed) : "—"));
  useEffect(() => {
    if (!valid) return;
    const d = parseTimestamp(date);
    setLabel(fmt(d));
    const id = setInterval(() => setLabel(fmt(d)), 30_000);
    return () => clearInterval(id);
  }, [date, valid]);
  if (!valid) {
    return <time>—</time>;
  }
  return (
    <time dateTime={parsed.toISOString()} title={parsed.toLocaleString()}>
      {label}
    </time>
  );
}
