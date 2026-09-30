import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

import { SiteNav } from "@/components/site-nav";

const searchSchema = z.object({ team: z.string().optional() });

export const Route = createFileRoute("/league/$leagueId")({
  validateSearch: (search) => searchSchema.parse(search),
  head: () => ({
    meta: [
      { title: "Mini-league — FPL League Hub" },
      {
        name: "description",
        content: "Standings, rival comparisons and ownership insights for your FPL mini-league.",
      },
      { property: "og:title", content: "Mini-league standings — FPL League Hub" },
      {
        property: "og:description",
        content: "Explore a Fantasy Premier League mini-league: standings, differentials and the points race.",
      },
    ],
  }),
  component: LeaguePage,
});

function LeaguePage() {
  const { leagueId } = Route.useParams();

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-3xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold">League {leagueId}</h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Standings, rival comparison, ownership and the points race are coming in the next step.
        </p>
      </main>
    </div>
  );
}
