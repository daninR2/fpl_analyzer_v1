import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
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
