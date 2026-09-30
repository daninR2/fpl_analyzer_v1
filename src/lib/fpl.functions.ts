import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { RawElement, RawFixture } from "./fpl/projections";
import type {
  Bootstrap,
  InsightPlayer,
  InsightsPayload,
  Matchup,
  MatchupSide,
  Recommendation,
  FreeAgentsPayload,
  H2HMatch,
  HistoryEntry,
  LeaguePayload,
  ManagerPayload,
  PicksPayload,
  SquadPick,
  StandingRow,
} from "./fpl/types";

const idSchema = z.number().int().positive().max(50_000_000);
const teamIdSchema = z.object({ teamId: idSchema });
const leagueIdSchema = z.object({ leagueId: idSchema });

type RawEntry = {
  entry: {
    id: number;
    name: string;
    player_first_name: string;
    player_last_name: string;
    overall_points: number;
    event_points: number;
    league_set: number[];
  };
};

type RawLeague = {
  league: { id: number; name: string; scoring: string };
  league_entries: {
    id: number;
    entry_id: number | null;
    entry_name: string;
    player_first_name: string;
    player_last_name: string;
  }[];
  standings: {
    league_entry: number;
    rank: number;
    last_rank: number | null;
    matches_won?: number;
    matches_drawn?: number;
    matches_lost?: number;
    points_for?: number;
    points_against?: number;
    event_total?: number;
    total: number;
  }[];
  matches?: {
    event: number;
    finished: boolean;
    started: boolean;
    league_entry_1: number;
    league_entry_1_points: number;
    league_entry_2: number;
    league_entry_2_points: number;
  }[];
};

async function loadBootstrap() {
  const { cached, fplFetch, TTL } = await import("./fpl/api.server");
  return cached<Bootstrap>("draft:bootstrap", TTL.bootstrap, () =>
    fplFetch<Bootstrap>("/bootstrap-static"),
  );
}

async function loadLeague(leagueId: number) {
  const { cached, fplFetch, TTL } = await import("./fpl/api.server");
  return cached<RawLeague>(`draft:league:${leagueId}`, TTL.standings, () =>
    fplFetch<RawLeague>(`/league/${leagueId}/details`),
  );
}

export const getManager = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => teamIdSchema.parse(input))
  .handler(async ({ data: input }): Promise<ManagerPayload> => {
    const { cached, fplFetch, TTL, FplError } = await import("./fpl/api.server");
    const { teamId } = input;

    try {
      const { data, fetchedAt, stale } = await cached<{
        entry: RawEntry;
        history: { history: HistoryEntry[] };
      }>(`draft:manager:${teamId}`, TTL.manager, async () => {
        const entry = await fplFetch<RawEntry>(`/entry/${teamId}/public`);
        const history = await fplFetch<{ history: HistoryEntry[] }>(`/entry/${teamId}/history`);
        return { entry, history };
      });
      const bootstrap = await loadBootstrap();

      const e = data.entry.entry;
      const leagueId = e.league_set?.[0] ?? null;
      let league: ManagerPayload["league"] = null;
      if (leagueId) {
        try {
          const l = (await loadLeague(leagueId)).data;
          const me = l.league_entries.find((x) => x.entry_id === teamId);
          const row = me ? l.standings.find((s) => s.league_entry === me.id) : undefined;
          league = {
            id: l.league.id,
            name: l.league.name,
            rank: row?.rank ?? null,
            won: row?.matches_won ?? 0,
            drawn: row?.matches_drawn ?? 0,
            lost: row?.matches_lost ?? 0,
            total: row?.total ?? 0,
            entries: l.league_entries.length,
          };
        } catch {
          league = null;
        }
      }

      return {
        manager: {
          id: e.id,
          name: e.name,
          player_first_name: e.player_first_name,
          player_last_name: e.player_last_name,
          overall_points: e.overall_points,
          event_points: e.event_points,
          leagueId,
          currentEvent: bootstrap.data.events.current ?? null,
        },
        league,
        history: (data.history.history ?? []).map((h) => ({
          event: h.event,
          points: h.points,
          total_points: h.total_points,
          points_on_bench: h.points_on_bench,
          event_transfers: h.event_transfers,
        })),
        stale,
        fetchedAt,
      };
    } catch (error) {
      if (error instanceof FplError && error.status === 404) {
        throw new Error(`No Draft FPL team found with ID ${teamId}. Double-check the number.`);
      }
      throw new Error(
        error instanceof Error ? error.message : "Could not load that team right now.",
      );
    }
  });

export const getPicks = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    teamIdSchema.extend({ gameweek: z.number().int().min(1).max(38) }).parse(input),
  )
  .handler(async ({ data: input }): Promise<PicksPayload> => {
    const { cached, fplFetch, TTL } = await import("./fpl/api.server");
    const { teamId, gameweek } = input;
    const bootstrap = await loadBootstrap();
    const currentEvent = bootstrap.data.events.current ?? 0;
    const ttl = gameweek < currentEvent ? TTL.picksPast : TTL.picksLive;

    try {
      const { data, fetchedAt, stale } = await cached<{
        picks: { element: number; position: number }[];
      }>(`draft:picks:${teamId}:${gameweek}`, ttl, () =>
        fplFetch(`/entry/${teamId}/event/${gameweek}`),
      );

      const byId = new Map(bootstrap.data.elements.map((e) => [e.id, e]));
      const teams = new Map(bootstrap.data.teams.map((t) => [t.id, t.short_name]));
      const types = new Map(bootstrap.data.element_types.map((t) => [t.id, t.singular_name_short]));

      const picks: SquadPick[] = (data.picks ?? []).map((p) => {
        const el = byId.get(p.element);
        return {
          playerId: p.element,
          name: el?.web_name ?? "Unknown",
          team: el ? (teams.get(el.team) ?? "") : "",
          position: el ? (types.get(el.element_type) ?? "") : "",
          positionId: el?.element_type ?? 0,
          points: el?.event_points ?? 0,
          onBench: p.position > 11,
        };
      });
      return { gameweek, picks, available: true, stale, fetchedAt };
    } catch {
      return {
        gameweek,
        picks: [],
        available: false,
        message: "Couldn't load the squad for this gameweek.",
        stale: false,
        fetchedAt: new Date().toISOString(),
      };
    }
  });

export const getLeague = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => leagueIdSchema.parse(input))
  .handler(async ({ data: input }): Promise<LeaguePayload> => {
    const { FplError } = await import("./fpl/api.server");
    try {
      const [{ data, fetchedAt, stale }, bootstrap] = await Promise.all([
        loadLeague(input.leagueId),
        loadBootstrap(),
      ]);
      const entries = new Map(data.league_entries.map((e) => [e.id, e]));
      const standings: StandingRow[] = data.standings.map((s) => {
        const e = entries.get(s.league_entry);
        return {
          rank: s.rank,
          lastRank: s.last_rank ?? null,
          entryId: e?.entry_id ?? 0,
          teamName: e?.entry_name ?? "Unknown",
          managerName: e ? `${e.player_first_name} ${e.player_last_name}` : "",
          won: s.matches_won ?? 0,
          drawn: s.matches_drawn ?? 0,
          lost: s.matches_lost ?? 0,
          pointsFor: s.points_for ?? s.event_total ?? 0,
          pointsAgainst: s.points_against ?? 0,
          total: s.total,
        };
      });
      const side = (id: number, points: number) => ({
        entryId: entries.get(id)?.entry_id ?? 0,
        teamName: entries.get(id)?.entry_name ?? "Unknown",
        points,
      });
      const matches: H2HMatch[] = (data.matches ?? []).map((m) => ({
        event: m.event,
        finished: m.finished,
        started: m.started,
        home: side(m.league_entry_1, m.league_entry_1_points),
        away: side(m.league_entry_2, m.league_entry_2_points),
      }));
      return {
        id: data.league.id,
        name: data.league.name,
        scoring: data.league.scoring === "h" ? "h2h" : "classic",
        currentEvent: bootstrap.data.events.current ?? null,
        standings,
        matches,
        stale,
        fetchedAt,
      };
    } catch (error) {
      if (error instanceof FplError && error.status === 404) {
        throw new Error(`No Draft league found with ID ${input.leagueId}.`);
      }
      throw new Error("Could not load this league right now.");
    }
  });

export const getFreeAgents = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => leagueIdSchema.parse(input))
  .handler(async ({ data: input }): Promise<FreeAgentsPayload> => {
    const { cached, fplFetch, TTL } = await import("./fpl/api.server");
    const [status, bootstrap] = await Promise.all([
      cached<{ element_status: { element: number; owner: number | null }[] }>(
        `draft:element-status:${input.leagueId}`,
        TTL.manager,
        () => fplFetch(`/league/${input.leagueId}/element-status`),
      ),
      loadBootstrap(),
    ]);
    const owned = new Set(
      status.data.element_status.filter((s) => s.owner !== null).map((s) => s.element),
    );
    const teams = new Map(bootstrap.data.teams.map((t) => [t.id, t.short_name]));
    const types = new Map(bootstrap.data.element_types.map((t) => [t.id, t.singular_name_short]));
    const players = bootstrap.data.elements
      .filter((e) => !owned.has(e.id))
      .map((e) => ({
        playerId: e.id,
        name: e.web_name,
        team: teams.get(e.team) ?? "",
        position: types.get(e.element_type) ?? "",
        positionId: e.element_type,
        totalPoints: e.total_points,
        form: Number(e.form) || 0,
        pointsPerGame: Number(e.points_per_game) || 0,
        status: e.status,
        news: e.news ?? "",
      }))
      .sort((a, b) => b.totalPoints - a.totalPoints);
    return { players, stale: status.stale, fetchedAt: status.fetchedAt };
  });

export const getInsights = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => teamIdSchema.parse(input))
  .handler(async ({ data: input }): Promise<InsightsPayload> => {
    const { cached, fplFetch, TTL } = await import("./fpl/api.server");
    const { projectPlayers, bestEleven, winProbability, round } = await import("./fpl/projections");
    const { teamId } = input;

    const bs = (await loadBootstrap()).data as unknown as Bootstrap & {
      elements: RawElement[];
      fixtures: Record<string, RawFixture[]>;
    };
    const entry = (
      await cached<RawEntry>(`draft:entry:${teamId}`, TTL.manager, () =>
        fplFetch<RawEntry>(`/entry/${teamId}/public`),
      )
    ).data.entry;
    const leagueId = entry.league_set?.[0];
    if (!leagueId) throw new Error("This team isn't in a draft league yet.");

    const [leagueRes, statusRes] = await Promise.all([
      loadLeague(leagueId),
      cached<{ element_status: { element: number; owner: number | null }[] }>(
        `draft:element-status:${leagueId}`,
        TTL.manager,
        () => fplFetch(`/league/${leagueId}/element-status`),
      ),
    ]);
    const league = leagueRes.data;

    const current = bs.events.current ?? 0;
    const fixtures = Object.values(bs.fixtures ?? {}).flat();
    const events = [...new Set(fixtures.map((f) => f.event))]
      .filter((e) => e > current || (e === current && !bs.events.data.find((d) => d.id === e)?.finished))
      .sort((a, b) => a - b)
      .slice(0, 3);
    if (events.length === 0) throw new Error("No upcoming fixtures are published yet.");

    const finishedGames = bs.events.data.filter((e) => e.finished).length;
    const { players } = projectPlayers({
      elements: bs.elements,
      teams: bs.teams,
      fixtures,
      events,
      gamesPlayed: finishedGames,
    });
    const strip = (p: ReturnType<typeof players.get>): InsightPlayer => {
      const { teamId: _t, totalPoints: _tp, ...rest } = p!;
      return rest;
    };

    const squadOf = (entryId: number) =>
      statusRes.data.element_status
        .filter((s) => s.owner === entryId && players.has(s.element))
        .map((s) => strip(players.get(s.element)));

    // Lineup: use the manager's most recent picks when available; else best XI.
    const lineupFor = async (entryId: number, ev: number) => {
      const squad = squadOf(entryId);
      let starters: InsightPlayer[] = [];
      if (ev === events[0] && current > 0) {
        try {
          const picks = (
            await cached<{ picks: { element: number; position: number }[] }>(
              `draft:picks:${entryId}:${current}`,
              TTL.picksLive,
              () => fplFetch(`/entry/${entryId}/event/${current}`),
            )
          ).data.picks;
          const ids = new Set(picks.filter((p) => p.position <= 11).map((p) => p.element));
          starters = squad.filter((p) => ids.has(p.playerId));
        } catch {
          starters = [];
        }
      }
      if (starters.length < 11) starters = bestEleven(squad as never, ev) as InsightPlayer[];
      const expected = round(starters.reduce((s, p) => s + (p.byEvent[ev] ?? 0), 0));
      return { starters: starters.sort((a, b) => a.positionId - b.positionId), expected };
    };

    const entriesById = new Map(league.league_entries.map((e) => [e.id, e]));
    const myLeagueEntry = league.league_entries.find((e) => e.entry_id === teamId);
    const matchups: Matchup[] = [];
    for (const ev of events) {
      const me = await lineupFor(teamId, ev);
      const match = (league.matches ?? []).find(
        (m) =>
          m.event === ev &&
          (m.league_entry_1 === myLeagueEntry?.id || m.league_entry_2 === myLeagueEntry?.id),
      );
      let opponent: MatchupSide | null = null;
      if (match) {
        const oppLe = entriesById.get(
          match.league_entry_1 === myLeagueEntry?.id ? match.league_entry_2 : match.league_entry_1,
        );
        if (oppLe?.entry_id) {
          const o = await lineupFor(oppLe.entry_id, ev);
          opponent = { entryId: oppLe.entry_id, teamName: oppLe.entry_name, ...o };
        }
      }
      matchups.push({
        event: ev,
        me: { entryId: teamId, teamName: entry.name, ...me },
        opponent,
        winProbability: opponent ? round(winProbability(me.expected, opponent.expected), 2) : null,
      });
    }

    const squad = squadOf(teamId).sort((a, b) => a.positionId - b.positionId || b.total - a.total);
    const owned = new Set(
      statusRes.data.element_status.filter((s) => s.owner !== null).map((s) => s.element),
    );
    const freeAgents = [...players.values()]
      .filter((p) => !owned.has(p.playerId) && p.availability > 0)
      .map(strip)
      .sort((a, b) => b.total - a.total);

    // Greedy best swaps: same position (draft squads have fixed shape).
    const candidates: Recommendation[] = [];
    for (const drop of squad) {
      for (const add of freeAgents.filter((f) => f.positionId === drop.positionId).slice(0, 15)) {
        const gain = round(add.total - drop.total);
        if (gain < 0.5) continue;
        const reasons: string[] = [];
        const avgDiff = (p: InsightPlayer) =>
          p.fixtures.reduce((s, f) => s + f.difficulty, 0) / Math.max(p.fixtures.length, 1);
        if (drop.availability < 1)
          reasons.push(`${drop.name} is doubtful${drop.news ? ` (${drop.news})` : ""}`);
        if (avgDiff(add) + 0.5 < avgDiff(drop))
          reasons.push(`Easier fixtures: ${add.fixtures.map((f) => `${f.opponent}${f.home ? " (H)" : " (A)"}`).join(", ")}`);
        const xgi = (p: InsightPlayer) => p.xg90 + p.xa90;
        if (xgi(add) > xgi(drop) + 0.1)
          reasons.push(`More attacking threat: ${xgi(add).toFixed(2)} xGI/90 vs ${xgi(drop).toFixed(2)}`);
        if (add.form > drop.form + 1) reasons.push(`Better form: ${add.form.toFixed(1)} vs ${drop.form.toFixed(1)}`);
        if (add.minutesShare > drop.minutesShare + 0.2)
          reasons.push(`Plays more: ${Math.round(add.minutesShare * 100)}% of minutes vs ${Math.round(drop.minutesShare * 100)}%`);
        if (add.fixtures.length > drop.fixtures.length) reasons.push("Has more fixtures in this window");
        if (reasons.length === 0) reasons.push("Higher projected points over the next few gameweeks");
        candidates.push({ add, drop, gain, reasons });
      }
    }
    candidates.sort((a, b) => b.gain - a.gain);
    const usedAdd = new Set<number>();
    const usedDrop = new Set<number>();
    const recommendations = candidates
      .filter((c) => {
        if (usedAdd.has(c.add.playerId) || usedDrop.has(c.drop.playerId)) return false;
        usedAdd.add(c.add.playerId);
        usedDrop.add(c.drop.playerId);
        return true;
      })
      .slice(0, 6);

    return {
      teamName: entry.name,
      leagueId,
      events,
      squad,
      matchups,
      recommendations,
      topFreeAgents: freeAgents.slice(0, 20),
      fetchedAt: leagueRes.fetchedAt,
    };
  });
