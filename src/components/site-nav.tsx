import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import { Trophy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { clearStoredTeamId, useStoredTeamId } from "@/lib/team-id";

export function SiteNav() {
  const stored = useStoredTeamId();
  const pathname = useLocation({ select: (l) => l.pathname });
  const fromPath = pathname.match(/^\/dashboard\/(\d+)/)?.[1] ?? null;
  const teamId = fromPath ?? stored;
  const navigate = useNavigate();

  return (
    <header className="sticky top-0 z-40 border-b border-border/70 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Trophy className="h-4 w-4" />
          </span>
          <span className="font-display text-base font-bold tracking-tight">FPL League Hub</span>
        </Link>

        <nav className="flex items-center gap-1 text-sm">
          {teamId ? (
            <Link
              to="/dashboard/$teamId"
              params={{ teamId }}
              className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              Dashboard
            </Link>
          ) : null}
          <Link
            to="/about"
            className="rounded-md px-3 py-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            About
          </Link>
          {teamId ? (
            <Button
              variant="outline"
              size="sm"
              className="ml-2"
              onClick={() => {
                clearStoredTeamId();
                navigate({ to: "/" });
              }}
            >
              Change Team ID
            </Button>
          ) : null}
        </nav>
      </div>
    </header>
  );
}
