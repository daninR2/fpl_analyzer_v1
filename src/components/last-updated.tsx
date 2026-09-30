import { RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

function relative(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 1) return "just now";
  if (mins === 1) return "1 minute ago";
  if (mins < 60) return `${mins} minutes ago`;
  const hours = Math.round(mins / 60);
  return hours === 1 ? "1 hour ago" : `${hours} hours ago`;
}

export function LastUpdated({
  fetchedAt,
  stale,
  onRefresh,
  refreshing,
}: {
  fetchedAt?: string | undefined;
  stale?: boolean | undefined;
  onRefresh: () => void;
  refreshing?: boolean | undefined;
}) {
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
      <span>Data last updated {fetchedAt ? relative(fetchedAt) : "—"}</span>
      {stale ? (
        <span className="rounded-full bg-warning/15 px-2 py-0.5 text-warning">
          Showing saved data — FPL is unreachable
        </span>
      ) : null}
      <Button variant="ghost" size="sm" onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={refreshing ? "animate-spin" : undefined} />
        Refresh
      </Button>
    </div>
  );
}
