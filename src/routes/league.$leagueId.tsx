import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp } from "lucide-react";
import { z } from "zod";

import { LastUpdated } from "@/components/last-updated";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getFreeAgents, getLeague } from "@/lib/fpl.functions";
import { cn } from "@/lib/utils";

const searchSchema = z.object({ team: z.coerce.string().optional() });

export const Route = createFileRoute("/league/$leagueId")({
  validateSearch: (search) => searchSchema.parse(search),
  head: ({ params }) => ({
    meta: [
      { title: `Draft league ${params.leagueId} — Draft FPL League Hub` },
      {
        name: "description",
        content: "League table, head-to-head results and best free agents for your Draft FPL league.",
      },
      { property: "og:title", content: "Draft league table — Draft FPL League Hub" },
      {
        property: "og:description",
        content: "Standings, weekly head-to-head matchups and free agents for a Draft FPL league.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LeaguePage,
});

const POSITIONS = [
  { id: 0, label: "All" },
  { id: 1, label: "GK" },
  { id: 2, label: "DEF" },
  { id: 3, label: "MID" },
  { id: 4, label: "FWD" },
];

function LeaguePage() {
  const { leagueId } = Route.useParams();
  const { team } = Route.useSearch();
  const myTeam = team ? Number(team) : null;
  const id = Number(leagueId);
  const valid = Number.isInteger(id) && id > 0;
  const queryClient = useQueryClient();
  const fetchLeague = useServerFn(getLeague);
  const fetchAgents = useServerFn(getFreeAgents);

  const leagueQuery = useQuery({
    queryKey: ["league", id],
    queryFn: () => fetchLeague({ data: { leagueId: id } }),
    enabled: valid,
    retry: false,
  });
  const agentsQuery = useQuery({
    queryKey: ["free-agents", id],
    queryFn: () => fetchAgents({ data: { leagueId: id } }),
    enabled: valid,
    retry: false,
  });

  const league = leagueQuery.data;
  const events = useMemo(
    () => [...new Set((league?.matches ?? []).map((m) => m.event))].sort((a, b) => a - b),
    [league],
  );
  const [gw, setGw] = useState<number | null>(null);
  const selectedGw = gw ?? league?.currentEvent ?? events[0] ?? null;
  const gwMatches = (league?.matches ?? []).filter((m) => m.event === selectedGw);

  const [pos, setPos] = useState(0);
  const agents = (agentsQuery.data?.players ?? [])
    .filter((p) => pos === 0 || p.positionId === pos)
    .slice(0, 25);

  if (leagueQuery.isError) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">We couldn't load this league</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {leagueQuery.error instanceof Error ? leagueQuery.error.message : "Something went wrong."}
          </p>
          <Button className="mt-6" onClick={() => leagueQuery.refetch()}>
            Try again
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {leagueQuery.isLoading ? (
              <Skeleton className="h-8 w-56" />
            ) : (
              <>
                <h1 className="text-3xl font-bold">{league?.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {league?.scoring === "h2h" ? "Head-to-head" : "Classic"} draft league
                  {league?.currentEvent ? ` · Gameweek ${league.currentEvent}` : ""}
                </p>
              </>
            )}
          </div>
          <LastUpdated
            fetchedAt={league?.fetchedAt}
            stale={league?.stale}
            refreshing={leagueQuery.isFetching}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["league", id] });
              queryClient.invalidateQueries({ queryKey: ["free-agents", id] });
            }}
          />
        </div>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            League table
          </h2>
          {leagueQuery.isLoading ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-3 text-left">#</th>
                    <th className="p-3 text-left">Team</th>
                    <th className="p-3 text-center">W</th>
                    <th className="p-3 text-center">D</th>
                    <th className="p-3 text-center">L</th>
                    <th className="p-3 text-right">PF</th>
                    <th className="p-3 text-right">PA</th>
                    <th className="p-3 text-right">Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {league?.standings.map((r) => {
                    const move = r.lastRank ? r.lastRank - r.rank : 0;
                    return (
                      <tr
                        key={r.entryId}
                        className={cn(
                          "border-b border-border/50 last:border-0",
                          r.entryId === myTeam && "bg-primary/10",
                        )}
                      >
                        <td className="p-3 font-semibold">
                          <span className="inline-flex items-center gap-1">
                            {r.rank}
                            {move > 0 ? <ArrowUp className="h-3 w-3 text-primary" /> : null}
                            {move < 0 ? <ArrowDown className="h-3 w-3 text-destructive" /> : null}
                          </span>
                        </td>
                        <td className="p-3">
                          <Link
                            to="/dashboard/$teamId"
                            params={{ teamId: String(r.entryId) }}
                            className="font-medium hover:text-primary"
                          >
                            {r.teamName}
                          </Link>
                          <p className="text-xs text-muted-foreground">{r.managerName}</p>
                        </td>
                        <td className="p-3 text-center">{r.won}</td>
                        <td className="p-3 text-center">{r.drawn}</td>
                        <td className="p-3 text-center">{r.lost}</td>
                        <td className="p-3 text-right">{r.pointsFor}</td>
                        <td className="p-3 text-right">{r.pointsAgainst}</td>
                        <td className="p-3 text-right font-display font-bold text-primary">
                          {r.total}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {events.length > 0 ? (
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Head-to-head · Gameweek {selectedGw}
              </h2>
              <select
                aria-label="Choose gameweek"
                value={selectedGw ?? ""}
                onChange={(e) => setGw(Number(e.target.value))}
                className="rounded-md border border-border bg-card px-3 py-1.5 text-sm"
              >
                {events.map((e) => (
                  <option key={e} value={e}>
                    Gameweek {e}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {gwMatches.map((m, i) => {
                const homeWin = m.finished && m.home.points > m.away.points;
                const awayWin = m.finished && m.away.points > m.home.points;
                return (
                  <div key={i} className="rounded-xl border border-border bg-card/60 p-4">
                    {[
                      { s: m.home, win: homeWin },
                      { s: m.away, win: awayWin },
                    ].map(({ s, win }) => (
                      <div key={s.entryId} className="flex items-center justify-between py-1">
                        <span
                          className={cn(
                            "truncate",
                            win && "font-semibold",
                            s.entryId === myTeam && "text-primary",
                          )}
                        >
                          {s.teamName}
                        </span>
                        <span className={cn("font-display text-lg", win && "font-bold text-primary")}>
                          {m.started ? s.points : "–"}
                        </span>
                      </div>
                    ))}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {m.finished ? "Final" : m.started ? "Live" : "Upcoming"}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        ) : null}

        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Best free agents
            </h2>
            <div className="flex gap-1">
              {POSITIONS.map((p) => (
                <Button
                  key={p.id}
                  size="sm"
                  variant={pos === p.id ? "default" : "outline"}
                  onClick={() => setPos(p.id)}
                >
                  {p.label}
                </Button>
              ))}
            </div>
          </div>
          {agentsQuery.isLoading ? (
            <Skeleton className="h-72 rounded-xl" />
          ) : agentsQuery.isError ? (
            <p className="text-sm text-muted-foreground">Couldn't load free agents right now.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-card/60">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase tracking-wider text-muted-foreground">
                  <tr className="border-b border-border">
                    <th className="p-3 text-left">Player</th>
                    <th className="p-3 text-left">Pos</th>
                    <th className="p-3 text-right">Form</th>
                    <th className="p-3 text-right">Pts/game</th>
                    <th className="p-3 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {agents.map((p) => (
                    <tr key={p.playerId} className="border-b border-border/50 last:border-0">
                      <td className="p-3">
                        <span className="font-medium">{p.name}</span>{" "}
                        <span className="text-xs text-muted-foreground">{p.team}</span>
                        {p.status !== "a" && p.news ? (
                          <p className="text-xs text-destructive">{p.news}</p>
                        ) : null}
                      </td>
                      <td className="p-3">{p.position}</td>
                      <td className="p-3 text-right">{p.form.toFixed(1)}</td>
                      <td className="p-3 text-right">{p.pointsPerGame.toFixed(1)}</td>
                      <td className="p-3 text-right font-display font-bold text-primary">
                        {p.totalPoints}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
