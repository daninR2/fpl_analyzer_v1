import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, ChevronRight } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { LastUpdated } from "@/components/last-updated";
import { Pitch } from "@/components/pitch";
import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { getManager, getPicks } from "@/lib/fpl.functions";
import { storeTeamId } from "@/lib/team-id";

export const Route = createFileRoute("/dashboard/$teamId")({
  head: ({ params }) => ({
    meta: [
      { title: `Team ${params.teamId} dashboard — Draft FPL League Hub` },
      {
        name: "description",
        content:
          "Gameweek points, points history, draft league record and current squad for this Draft FPL team.",
      },
      { property: "og:title", content: "Draft FPL manager dashboard" },
      {
        property: "og:description",
        content: "Points history, head-to-head record and squad for any Draft FPL team.",
      },
    ],
  }),
  component: Dashboard,
});

const chartTooltip = {
  contentStyle: {
    background: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "0.75rem",
    color: "var(--foreground)",
    fontSize: "12px",
  },
  labelStyle: { color: "var(--muted-foreground)" },
};

const LEAGUE_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
  "var(--chart-7)",
  "var(--chart-8)",
];

type LeagueMetric = "points" | "recordPoints" | "totalPoints";
const METRICS: { key: LeagueMetric; label: string }[] = [
  { key: "points", label: "Points per gameweek" },
  { key: "recordPoints", label: "Record" },
  { key: "totalPoints", label: "Total points" },
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card/60 p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold">{value}</p>
    </div>
  );
}

function Dashboard() {
  const { teamId } = Route.useParams();
  const numericId = Number(teamId);
  const queryClient = useQueryClient();
  const fetchManager = useServerFn(getManager);
  const fetchPicks = useServerFn(getPicks);
  const [leagueMetric, setLeagueMetric] = useState<LeagueMetric>("points");

  useEffect(() => {
    if (Number.isInteger(numericId) && numericId > 0) storeTeamId(teamId);
  }, [numericId, teamId]);

  const managerQuery = useQuery({
    queryKey: ["manager", numericId],
    queryFn: () => fetchManager({ data: { teamId: numericId } }),
    enabled: Number.isInteger(numericId) && numericId > 0,
    retry: false,
  });

  const gameweek = managerQuery.data?.manager.currentEvent ?? null;

  const picksQuery = useQuery({
    queryKey: ["picks", numericId, gameweek],
    queryFn: () => fetchPicks({ data: { teamId: numericId, gameweek: gameweek! } }),
    enabled: !!gameweek,
    retry: false,
  });

  if (managerQuery.isError) {
    return (
      <div className="min-h-screen">
        <SiteNav />
        <main className="mx-auto max-w-md px-4 py-24 text-center">
          <AlertTriangle className="mx-auto h-8 w-8 text-destructive" />
          <h1 className="mt-4 text-xl font-semibold">We couldn't load this team</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {managerQuery.error instanceof Error
              ? managerQuery.error.message
              : "Something went wrong."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            <Button onClick={() => managerQuery.refetch()}>Try again</Button>
            <Button variant="outline" asChild>
              <Link to="/">Use another team ID</Link>
            </Button>
          </div>
        </main>
      </div>
    );
  }

  const data = managerQuery.data;
  const history = data?.history ?? [];
  const leagueChart = useMemo(() => {
    const rows = new Map<number, Record<string, number | string>>();
    for (const team of data?.leagueHistory ?? []) {
      for (const point of team.history) {
        const row = rows.get(point.event) ?? { event: point.event };
        row[String(team.entryId)] = point[leagueMetric];
        row[`${team.entryId}:record`] = point.record;
        rows.set(point.event, row);
      }
    }
    return [...rows.values()].sort((a, b) => Number(a.event) - Number(b.event));
  }, [data?.leagueHistory, leagueMetric]);
  
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            {managerQuery.isLoading ? (
              <>
                <Skeleton className="h-8 w-56" />
                <Skeleton className="mt-2 h-4 w-40" />
              </>
            ) : (
              <>
                <h1 className="text-3xl font-bold">{data?.manager.name}</h1>
                <p className="text-sm text-muted-foreground">
                  {data?.manager.player_first_name} {data?.manager.player_last_name}
                  {gameweek ? ` · Gameweek ${gameweek}` : ""}
                </p>
              </>
            )}
          </div>
          <LastUpdated
            fetchedAt={data?.fetchedAt}
            stale={data?.stale}
            refreshing={managerQuery.isFetching}
            onRefresh={() => {
              queryClient.invalidateQueries({ queryKey: ["manager", numericId] });
              queryClient.invalidateQueries({ queryKey: ["picks", numericId] });
            }}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {managerQuery.isLoading
            ? Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : (
                <>
                  <Stat label="Total points" value={String(data?.manager.overall_points ?? 0)} />
                  <Stat
                    label="League position"
                    value={
                      data?.league?.rank ? `${data.league.rank} of ${data.league.entries}` : "—"
                    }
                  />
                  <Stat label="Gameweek points" value={String(data?.manager.event_points ?? 0)} />
                  <Stat
                    label="Record (W-D-L)"
                    value={
                      data?.league
                        ? `${data.league.won}-${data.league.drawn}-${data.league.lost}`
                        : "—"
                    }
                  />
                </>
              )}
        </div>

        {managerQuery.isLoading || (data?.leagueHistory.length ?? 0) > 0 ? (
          <section className="rounded-xl border border-border bg-card/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  League comparison
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">Every team, gameweek by gameweek</p>
              </div>
              <div className="flex flex-wrap gap-1" aria-label="League chart metric">
                {METRICS.map((metric) => (
                  <Button
                    key={metric.key}
                    size="sm"
                    variant={leagueMetric === metric.key ? "default" : "outline"}
                    onClick={() => setLeagueMetric(metric.key)}
                  >
                    {metric.label}
                  </Button>
                ))}
              </div>
            </div>
            <div className="mt-5 h-80">
              {managerQuery.isLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={leagueChart} margin={{ top: 8, right: 12, left: -12, bottom: 8 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="event" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} allowDecimals={false} />
                    <Tooltip
                      {...chartTooltip}
                      labelFormatter={(event) => `Gameweek ${event}`}
                      formatter={(value, name, item) => {
                        const team = data?.leagueHistory.find((entry) => String(entry.entryId) === String(item.dataKey));
                        const record = item.payload?.[`${item.dataKey}:record`];
                        return [leagueMetric === "recordPoints" ? `${value} pts · ${record} W-D-L` : value, team?.teamName ?? name];
                      }}
                    />
                    {(data?.leagueHistory ?? []).map((team, index) => (
                      <Line
                        key={team.entryId}
                        type="monotone"
                        dataKey={String(team.entryId)}
                        name={team.teamName}
                        stroke={LEAGUE_COLORS[index % LEAGUE_COLORS.length]}
                        strokeWidth={team.isCurrentTeam ? 3 : 2}
                        strokeDasharray={team.isCurrentTeam ? undefined : index >= LEAGUE_COLORS.length ? "5 3" : undefined}
                        dot={false}
                        connectNulls
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
              {(data?.leagueHistory ?? []).map((team, index) => (
                <span key={team.entryId} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="h-0.5 w-4" style={{ backgroundColor: LEAGUE_COLORS[index % LEAGUE_COLORS.length] }} />
                  <span className={team.isCurrentTeam ? "font-semibold text-foreground" : undefined}>{team.teamName}</span>
                </span>
              ))}
            </div>
          </section>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Total points over time
            </h2>
            <div className="mt-4 h-64">
              {managerQuery.isLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={history}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="event" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip {...chartTooltip} />
                    <Line
                      type="monotone"
                      dataKey="total_points"
                      name="Total points"
                      stroke="var(--chart-1)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card/60 p-5">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
              Points per gameweek
            </h2>
            <div className="mt-4 h-64">
              {managerQuery.isLoading ? (
                <Skeleton className="h-full w-full rounded-lg" />
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={history}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="event" stroke="var(--muted-foreground)" fontSize={11} />
                    <YAxis stroke="var(--muted-foreground)" fontSize={11} />
                    <Tooltip {...chartTooltip} />
                    <Bar dataKey="points" name="Points" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        <Link
          to="/insights/$teamId"
          params={{ teamId }}
          className="group flex items-center justify-between gap-3 rounded-xl border border-primary/40 bg-primary/10 p-4 transition-colors hover:border-primary"
        >
          <div>
            <p className="font-semibold text-primary">Predictions & pickups</p>
            <p className="text-xs text-muted-foreground">
              Expected points for you and your opponent, plus who to pick up and drop
            </p>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
        </Link>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Draft league
          </h2>
          {managerQuery.isLoading ? (
            <Skeleton className="h-20 rounded-xl" />
          ) : !data?.league ? (
            <p className="text-sm text-muted-foreground">This team isn't in a draft league yet.</p>
          ) : (
            <Link
              to="/league/$leagueId"
              params={{ leagueId: String(data.league.id) }}
              search={{ team: numericId }}
              className="group flex items-center justify-between gap-3 rounded-xl border border-border bg-card/60 p-4 transition-colors hover:border-primary/50"
            >
              <div className="min-w-0">
                <p className="truncate font-medium">{data.league.name}</p>
                <p className="text-xs text-muted-foreground">
                  Table, head-to-head results and free agents
                </p>
              </div>
              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          )}
        </section>

        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Current squad
          </h2>
          {picksQuery.isLoading || managerQuery.isLoading ? (
            <Skeleton className="h-96 rounded-xl" />
          ) : picksQuery.data?.available ? (
            <Pitch picks={picksQuery.data.picks} />
          ) : (
            <p className="rounded-xl border border-border bg-card/60 p-6 text-sm text-muted-foreground">
              {picksQuery.data?.message ?? "No squad to show for this gameweek yet."}
            </p>
          )}
        </section>
      </main>
    </div>
  );
}
