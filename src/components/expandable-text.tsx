"use client";

import { useLayoutEffect, useRef, useState } from "react";

export function ExpandableText({ text, className = "" }: { text: string; className?: string }) {
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    setOverflows(el.scrollHeight - el.clientHeight > 1);
  }, [text]);

  return (
    <div className={className}>
      <p
        ref={ref}
        className={`text-sm text-neutral-600 ${expanded ? "" : "line-clamp-2"}`}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-1 text-xs font-medium text-brand-700 hover:text-brand-800"
        >
          {expanded ? "View less" : "View more"}
        </button>
      )}
    </div>
  );
}
