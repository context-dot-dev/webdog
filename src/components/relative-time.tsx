"use client";

import { useEffect, useState } from "react";

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

export function RelativeTime({ date }: { date: Date }) {
  const [label, setLabel] = useState(() => fmt(date));
  useEffect(() => {
    setLabel(fmt(date));
    const id = setInterval(() => setLabel(fmt(date)), 30_000);
    return () => clearInterval(id);
  }, [date]);
  return (
    <time dateTime={date.toISOString()} title={date.toLocaleString()}>
      {label}
    </time>
  );
}
