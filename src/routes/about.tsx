import { createFileRoute } from "@tanstack/react-router";

import { SiteNav } from "@/components/site-nav";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — FPL League Hub" },
      {
        name: "description",
        content:
          "How FPL League Hub works, what data it uses, and why it is an unofficial Draft Fantasy Premier League tool.",
      },
      { property: "og:title", content: "About FPL League Hub" },
      {
        property: "og:description",
        content: "An unofficial Draft Fantasy Premier League analytics tool built on public FPL data.",
      },
    ],
  }),
  component: About,
});

function About() {
  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-12">
        <div>
          <h1 className="text-3xl font-bold">About FPL League Hub</h1>
          <p className="mt-3 text-muted-foreground">
            FPL League Hub turns your public Draft Fantasy Premier League team ID into readable analytics:
            rank history, gameweek points, your draft leagues and your squad on a pitch.
          </p>
        </div>

        <section className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="text-lg font-semibold">How it works</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Everything comes from the public Draft Fantasy Premier League data feed, fetched on our server
            and cached for a few minutes so pages load fast and the game's servers aren't hammered.
            You never enter a password, and no account is created.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="text-lg font-semibold">Unofficial</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            This site is not affiliated with, endorsed by, or connected to the Premier League or
            Draft Fantasy Premier League. All team and player data belongs to its respective owners.
          </p>
        </section>

        <section className="rounded-xl border border-border bg-card/60 p-6">
          <h2 className="text-lg font-semibold">Built with</h2>
          <ul className="mt-2 grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">
            <li>React + TypeScript</li>
            <li>TanStack Start &amp; Router</li>
            <li>TanStack Query</li>
            <li>Tailwind CSS + shadcn/ui</li>
            <li>Recharts</li>
            <li>Lovable Cloud (Postgres cache)</li>
          </ul>
        </section>
      </main>
    </div>
  );
}
