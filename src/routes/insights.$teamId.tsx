import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AlertTriangle, ArrowRight, Sparkles, TrendingUp } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getInsights } from "@/lib/fpl.functions";
import type { InsightPlayer, MatchupSide } from "@/lib/fpl/types";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/insights/$teamId")({
  head: ({ params }) => ({
    meta: [
      { title: `Predictions & pickups for team ${params.teamId} — Draft FPL League Hub` },
      {
        name: "description",
        content:
          "Expected points for your Draft FPL team and your opponent, plus waiver pickups and drops based on fixtures, xG, xA and form.",
      },
      { property: "og:title", content: "Draft FPL predictions & waiver advice" },
      {
        property: "og:description",
        content: "Head-to-head score predictions and data-driven pickup/drop recommendations.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: InsightsPage,
});

const DIFF_CLASS: Record<number, string> = {
  1: "bg-primary text-primary-foreground",
  2: "bg-primary/40 text-foreground",
  3: "bg-muted text-foreground",
  4: "bg-destructive/40 text-foreground",
  5: "bg-destructive text-destructive-foreground",
};

function FixtureChips({ p }: { p: InsightPlayer }) {
  if (p.fixtures.length === 0) return <span className="text-xs text-muted-foreground">No fixture</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {p.fixtures.map((f, i) => (
        <span
          key={i}
          title={`GW${f.event}: ${f.xPts} xPts`}
          className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", DIFF_CLASS[f.difficulty])}
        >
          {f.opponent}
          {f.home ? "" : " (a)"}
        </span>
      ))}
    </div>
  );
}

function SideList({ side, event, align }: { side: MatchupSide; event: number; align: "left" | "right" }) {
  return (
    <div className="space-y-1">
      {side.starters.map((p) => (
        <div
          key={p.playerId}
          className={cn(
            "flex items-center justify-between gap-2 rounded-md px-2 py-1 text-sm odd:bg-muted/30",
            align === "right" && "flex-row-reverse",
          )}
        >
          <span className={cn("min-w-0 truncate", align === "right" && "text-right")}>
            <span className="font-medium">{p.name}</span>{" "}
            <span className="text-xs text-muted-foreground">
              {p.position} · vs {p.fixtures.filter((f) => f.event === event).map((f) => f.opponent).join(", ") || "—"}
            </span>
            {p.availability < 1 ? <span className="ml-1 text-xs text-destructive">{Math.round(p.availability * 100)}%</span> : null}
          </span>
          <span className="font-display font-semibold tabular-nums">{(p.byEvent[event] ?? 0).toFixed(1)}</span>
        </div>
      ))}
    </div>
  );
}

function InsightsPage() {
  const { teamId } = Route.useParams();
  const id = Number(teamId);
  const fetchInsights = useServerFn(getInsights);
  const q = useQuery({
    queryKey: ["insights", id],
    queryFn: () => fetchInsights({ data: { teamId: id } }),
    enabled: Number.isInteger(id) && id > 0,
    retry: false,
  });
  const [tab, setTab] = useState(0);
  const data = q.data;
  const matchup = data?.matchups[tab];

  if (q.isError) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">We couldn't build predictions</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {q.error instanceof Error ? q.error.message : "Something went wrong."}
          </p>
          <Button className="mt-6" onClick={() => q.refetch()}>
            Try again
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl space-y-10 px-4 py-8">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
            <Sparkles className="h-4 w-4" /> Predictions & pickups
          </p>
          {q.isLoading ? (
            <Skeleton className="mt-2 h-8 w-64" />
          ) : (
            <h1 className="mt-1 text-3xl font-bold">{data?.teamName}</h1>
          )}
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Expected points use each player's xG, xA, minutes, clean-sheet odds, saves, bonus,
            defensive contributions and availability, adjusted for every club's strength and a
            completed 2025/26 baseline.
          </p>
        </div>

        {/* Matchups */}
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Head-to-head prediction
            </h2>
            <div className="flex gap-1">
              {(data?.matchups ?? []).map((m, i) => (
                <Button key={m.event} size="sm" variant={tab === i ? "default" : "outline"} onClick={() => setTab(i)}>
                  GW {m.event}
                </Button>
              ))}
            </div>
          </div>
          {q.isLoading || !matchup ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <div className="rounded-xl border border-border bg-card/60 p-5">
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">You</p>
                  <p className="truncate text-lg font-semibold">{matchup.me.teamName}</p>
                  <p className="font-display text-4xl font-bold text-primary">{matchup.me.expected.toFixed(1)}</p>
                </div>
                <span className="text-sm text-muted-foreground">vs</span>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Opponent</p>
                  <p className="truncate text-lg font-semibold">{matchup.opponent?.teamName ?? "No match"}</p>
                  <p className="font-display text-4xl font-bold">{matchup.opponent?.expected.toFixed(1) ?? "—"}</p>
                </div>
              </div>
              {matchup.winProbability !== null ? (
                <div className="mt-4">
                  <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                    <div className="bg-primary" style={{ width: `${matchup.winProbability * 100}%` }} />
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {Math.round(matchup.winProbability * 100)}% chance you win this gameweek
                  </p>
                </div>
              ) : null}
              <div className="mt-6 grid gap-6 md:grid-cols-2">
                <SideList side={matchup.me} event={matchup.event} align="left" />
                {matchup.opponent ? (
                  <SideList side={matchup.opponent} event={matchup.event} align="right" />
                ) : null}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Uses each manager's current starting XI for the next gameweek, and their best projected XI after that.
              </p>
            </div>
          )}
        </section>

        {/* Recommendations */}
        <section className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            <TrendingUp className="h-4 w-4" /> Recommended pickups
          </h2>
          {q.isLoading ? (
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
            </div>
          ) : (data?.recommendations.length ?? 0) === 0 ? (
            <p className="rounded-xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
              Your squad already beats every available free agent. Nice.
            </p>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {data!.recommendations.map((r) => (
                <div key={`${r.add.playerId}-${r.drop.playerId}`} className="rounded-xl border border-border bg-card/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-xs uppercase tracking-wider text-primary">Pick up</p>
                      <p className="truncate font-semibold">{r.add.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.add.team} · {r.add.position} · {r.add.total.toFixed(1)} xPts
                      </p>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 rotate-180 text-muted-foreground" />
                    <div className="min-w-0 text-right">
                      <p className="text-xs uppercase tracking-wider text-destructive">Drop</p>
                       <p className="truncate font-semibold">{r.drop.name}{r.drop.established ? "*" : ""}</p>
                      <p className="text-xs text-muted-foreground">
                        {r.drop.team} · {r.drop.total.toFixed(1)} xPts
                      </p>
                    </div>
                  </div>
                  <p className="mt-3 font-display text-lg font-bold text-primary">+{r.gain.toFixed(1)} expected points</p>
                  <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                    {r.reasons.map((reason) => (
                      <li key={reason}>• {reason}</li>
                    ))}
                  </ul>
                   {r.caution ? (
                     <p className="mt-3 rounded-md bg-warning/10 px-2.5 py-2 text-xs text-warning">
                       * {r.caution}
                     </p>
                   ) : null}
                  <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                    <FixtureChips p={r.add} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Squad projections */}
        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your squad — projected points
          </h2>
          {q.isLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <ProjectionTable players={data!.squad} events={data!.events} />
          )}
        </section>

        <section className="space-y-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Best available free agents
          </h2>
          {q.isLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : (
            <ProjectionTable players={data!.topFreeAgents} events={data!.events} />
          )}
          {data ? (
            <Link
              to="/league/$leagueId"
              params={{ leagueId: String(data.leagueId) }}
              search={{ team: id }}
              className="text-sm text-primary hover:underline"
            >
              Back to league table
            </Link>
          ) : null}
        </section>
      </main>
    </div>
  );
}

function ProjectionTable({ players, events }: { players: InsightPlayer[]; events: number[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
      <table className="w-full text-sm">
        <thead className="text-xs uppercase tracking-wider text-muted-foreground">
          <tr className="border-b border-border">
            <th className="p-3 text-left">Player</th>
            <th className="p-3 text-left">Fixtures</th>
            <th className="p-3 text-right">xG/90</th>
            <th className="p-3 text-right">xA/90</th>
            <th className="p-3 text-right">Mins</th>
            {events.map((e) => (
              <th key={e} className="p-3 text-right">GW{e}</th>
            ))}
            <th className="p-3 text-right">Total</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr key={p.playerId} className="border-b border-border/50 last:border-0">
              <td className="p-3">
                <span className="font-medium">{p.name}</span>{" "}
                <span className="text-xs text-muted-foreground">
                  {p.team} · {p.position}
                </span>
                {p.availability < 1 ? (
                  <p className="text-xs text-destructive">
                    {Math.round(p.availability * 100)}% to play{p.news ? ` — ${p.news}` : ""}
                  </p>
                ) : null}
              </td>
              <td className="p-3"><FixtureChips p={p} /></td>
              <td className="p-3 text-right tabular-nums">{p.xg90.toFixed(2)}</td>
              <td className="p-3 text-right tabular-nums">{p.xa90.toFixed(2)}</td>
              <td className="p-3 text-right tabular-nums">{Math.round(p.minutesShare * 100)}%</td>
              {events.map((e) => (
                <td key={e} className="p-3 text-right tabular-nums">{(p.byEvent[e] ?? 0).toFixed(1)}</td>
              ))}
              <td className="p-3 text-right font-display font-bold text-primary">{p.total.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
