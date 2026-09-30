import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  Bootstrap,
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
