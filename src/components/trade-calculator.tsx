import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { evaluateTrade } from "@/lib/fpl/value";
import type { InsightPlayer } from "@/lib/fpl/types";
import { cn } from "@/lib/utils";

type Rival = { entryId: number; teamName: string; squad: InsightPlayer[] };

function PickList({ title, players, selected, toggle }: { title: string; players: InsightPlayer[]; selected: Set<number>; toggle: (id: number) => void }) {
  const sorted = [...players].sort((a, b) => a.positionId - b.positionId || (b.holdValue ?? 0) - (a.holdValue ?? 0));
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{title}</p>
      <div className="flex flex-wrap gap-2">
        {sorted.map((p) => (
          <button
            key={p.playerId}
            type="button"
            onClick={() => toggle(p.playerId)}
            aria-pressed={selected.has(p.playerId)}
            className={cn(
              "rounded-md border px-2 py-1 text-xs transition-colors",
              selected.has(p.playerId) ? "border-primary bg-primary/15 text-foreground" : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            <span className="mr-1 text-[10px] opacity-70">{p.position}</span>
            {p.name}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TradeCalculator({ mine, rivals, nowEvents, holdEvents, gamesPlayed }: { mine: InsightPlayer[]; rivals: Rival[]; nowEvents: number[]; holdEvents: number[]; gamesPlayed: number }) {
  const [rivalId, setRivalId] = useState<number | null>(rivals[0]?.entryId ?? null);
  const [give, setGive] = useState<Set<number>>(new Set());
  const [receive, setReceive] = useState<Set<number>>(new Set());
  const rival = rivals.find((r) => r.entryId === rivalId) ?? null;

  const toggle = (set: Set<number>, update: (s: Set<number>) => void) => (id: number) => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    update(next);
  };

  const result = useMemo(() => {
    if (!rival || give.size === 0 || receive.size === 0) return null;
    return evaluateTrade(
      mine,
      rival.squad,
      mine.filter((p) => give.has(p.playerId)),
      rival.squad.filter((p) => receive.has(p.playerId)),
      nowEvents,
      holdEvents,
      gamesPlayed,
    );
  }, [rival, give, receive, mine, nowEvents, holdEvents, gamesPlayed]);

  if (!rivals.length) return <p className="text-sm text-muted-foreground">No rival squads available to trade with.</p>;

  const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(1)}`;
  const label = { good: "Good trade for you", even: "Roughly even", bad: "Bad trade for you" } as const;

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex flex-wrap gap-2">
        {rivals.map((r) => (
          <Button
            key={r.entryId}
            size="sm"
            variant={r.entryId === rivalId ? "default" : "outline"}
            onClick={() => {
              setRivalId(r.entryId);
              setReceive(new Set());
            }}
          >
            {r.teamName}
          </Button>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <PickList title="You give" players={mine} selected={give} toggle={toggle(give, setGive)} />
        {rival ? <PickList title={`You get from ${rival.teamName}`} players={rival.squad} selected={receive} toggle={toggle(receive, setReceive)} /> : null}
      </div>
      {result ? (
        <div className="space-y-2 rounded-lg border border-border bg-background/50 p-4">
          <p className={cn("font-display text-lg font-bold", result.verdict === "good" ? "text-primary" : result.verdict === "bad" ? "text-destructive" : "text-warning")}>
            {label[result.verdict]}
          </p>
          <p className="text-sm">
            Long term (next {holdEvents.length} GWs): <strong>{fmt(result.myHold)}</strong> squad points for you · {fmt(result.theirHold)} for them
          </p>
          <p className="text-sm text-muted-foreground">
            Next {nowEvents.length} GWs: {fmt(result.myNow)} · Chance it works out for you: {Math.round(result.confidence * 100)}%
          </p>
          {result.notes.length ? (
            <ul className="list-disc space-y-1 pl-5 text-xs text-muted-foreground">
              {result.notes.map((n) => <li key={n}>{n}</li>)}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">Pick at least one player on each side to see the verdict.</p>
      )}
    </div>
  );
}
