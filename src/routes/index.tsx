import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, HelpCircle, Loader2 } from "lucide-react";

import { SiteNav } from "@/components/site-nav";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getManager } from "@/lib/fpl.functions";
import { readStoredTeamId, storeTeamId } from "@/lib/team-id";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FPL League Hub — Mini-league analytics for Draft Fantasy Premier League" },
      {
        name: "description",
        content:
          "Track your Draft FPL league, head-to-head results and free agents with just your public team ID. No login, no password.",
      },
      { property: "og:title", content: "FPL League Hub" },
      {
        property: "og:description",
        content: "Draft Fantasy Premier League draft league analytics and squad insights from your team ID.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const lookup = useServerFn(getManager);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const stored = readStoredTeamId();
    if (stored) navigate({ to: "/dashboard/$teamId", params: { teamId: stored } });
  }, [navigate]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const id = Number(value.trim());
    if (!Number.isInteger(id) || id <= 0) {
      setError("Please enter a valid team ID — it's a number like 13781.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await lookup({ data: { teamId: id } });
      storeTeamId(String(id));
      navigate({ to: "/dashboard/$teamId", params: { teamId: String(id) } });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't find that team. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen">
      <SiteNav />
      <main className="mx-auto flex max-w-3xl flex-col items-center px-4 py-20 text-center sm:py-28">
        <span className="rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          Unofficial Draft FPL analytics
        </span>
        <h1 className="mt-6 text-4xl font-bold leading-tight sm:text-6xl">
          Win your <span className="text-gradient-primary">draft league</span>.
        </h1>
        <p className="mt-4 max-w-xl text-balance text-muted-foreground">
          League table, head-to-head results and free agents — all from your public Draft FPL team ID.
          No login, no password, nothing to install.
        </p>

        <form onSubmit={submit} className="mt-10 flex w-full max-w-md flex-col gap-3 sm:flex-row">
          <Input
            inputMode="numeric"
            placeholder="Enter your Draft FPL Team ID"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            className="h-12 text-base"
            aria-label="Draft FPL Team ID"
          />
          <Button type="submit" size="lg" className="h-12" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" /> : <ArrowRight />}
            {loading ? "Checking" : "Go"}
          </Button>
        </form>

        {error ? <p className="mt-3 text-sm text-destructive">{error}</p> : null}

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="ghost" size="sm" className="mt-4 text-muted-foreground">
              <HelpCircle /> How do I find my ID?
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Finding your Draft FPL Team ID</DialogTitle>
              <DialogDescription>
                Sign in at draft.premierleague.com, open the "Points" tab, and look at the web
                address. Your team ID is the number right after /entry/.
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs leading-relaxed">
              draft.premierleague.com/entry/
              <span className="font-bold text-primary">13781</span>/event/8
            </div>
            <p className="text-sm text-muted-foreground">
              In this example the team ID is <span className="font-semibold text-foreground">13781</span>.
            </p>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  );
}
