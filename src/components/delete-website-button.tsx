"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteWebsiteButton({ websiteId }: { websiteId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (!confirm("Delete this website and all its targets, snapshots, and alerts? This cannot be undone.")) return;
    setBusy(true);
    const res = await fetch(`/api/websites/${websiteId}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    }
  }

  return (
    <button type="button" onClick={remove} disabled={busy} className="btn-ghost text-xs px-2 py-1.5">
      {busy ? "Deleting…" : "Delete website"}
    </button>
  );
}
