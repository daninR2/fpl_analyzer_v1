import type { SquadPick } from "@/lib/fpl/types";

function PlayerChip({ pick }: { pick: SquadPick }) {
  return (
    <div className="flex w-[4.5rem] flex-col items-center gap-1 sm:w-24">
      <div className="relative w-full rounded-lg border border-border/70 bg-card/90 px-1 py-1.5 text-center shadow-sm">
        <p className="truncate text-[11px] font-semibold sm:text-xs">{pick.name}</p>
        <p className="text-[10px] text-muted-foreground">{pick.team}</p>
      </div>
      <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
        {pick.points} pts
      </span>
    </div>
  );
}

function Row({ picks }: { picks: SquadPick[] }) {
  if (picks.length === 0) return null;
  return <div className="flex flex-wrap justify-center gap-2 sm:gap-4">{picks.map((p) => <PlayerChip key={p.playerId} pick={p} />)}</div>;
}

export function Pitch({ picks }: { picks: SquadPick[] }) {
  const starters = picks.filter((p) => !p.onBench);
  const bench = picks.filter((p) => p.onBench);
  const byType = (id: number) => starters.filter((p) => p.positionId === id);

  return (
    <div className="space-y-4">
      <div className="relative overflow-hidden rounded-xl border border-border bg-pitch p-4 sm:p-6">
        <div className="pointer-events-none absolute inset-4 rounded-lg border border-pitch-line/60" />
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-pitch-line/60" />
        <div className="relative space-y-6">
          <Row picks={byType(1)} />
          <Row picks={byType(2)} />
          <Row picks={byType(3)} />
          <Row picks={byType(4)} />
        </div>
      </div>
      {bench.length > 0 ? (
        <div className="rounded-xl border border-border bg-card/60 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Bench
          </p>
          <Row picks={bench} />
        </div>
      ) : null}
    </div>
  );
}
