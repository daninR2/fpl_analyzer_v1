import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type {
  Bootstrap,
  BootstrapPayload,
  ChipPlay,
  HistoryEntry,
  ManagerInfo,
  ManagerLeague,
  ManagerPayload,
  PicksPayload,
  SquadPick,
} from "./fpl/types";

const teamIdSchema = z.object({ teamId: z.number().int().positive().max(20_000_000) });

export const getBootstrap = createServerFn({ method: "GET" }).handler(
  async (): Promise<BootstrapPayload> => {
    const { cached, fplFetch, TTL } = await import("./fpl/api.server");
    const { data, fetchedAt, stale } = await cached<Bootstrap>("bootstrap", TTL.bootstrap, () =>
      fplFetch<Bootstrap>("/bootstrap-static/"),
    );
    const current = data.events.find((e) => e.is_current);
    return {
      teams: data.teams,
      events: data.events.map((e) => ({
        id: e.id,
        name: e.name,
        is_current: e.is_current,
        is_next: e.is_next,
        finished: e.finished,
        deadline_time: e.deadline_time,
      })),
      currentEvent: current?.id ?? null,
      stale,
      fetchedAt,
    };
  },
);

export const getManager = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => teamIdSchema.parse(input))
  .handler(async ({ data: input }): Promise<ManagerPayload> => {
    const { cached, fplFetch, TTL, FplError } = await import("./fpl/api.server");
    const { teamId } = input;

    try {
      const { data, fetchedAt, stale } = await cached<{
        entry: ManagerInfo & { leagues: { classic: ManagerLeague[] } };
        history: { current: HistoryEntry[]; chips: ChipPlay[] };
      }>(`manager:${teamId}`, TTL.manager, async () => {
        const entry = await fplFetch<ManagerInfo & { leagues: { classic: ManagerLeague[] } }>(
          `/entry/${teamId}/`,
        );
        const history = await fplFetch<{ current: HistoryEntry[]; chips: ChipPlay[] }>(
          `/entry/${teamId}/history/`,
        );
        return { entry, history };
      });

      const { entry, history } = data;
      return {
        manager: {
          id: entry.id,
          name: entry.name,
          player_first_name: entry.player_first_name,
          player_last_name: entry.player_last_name,
          summary_overall_points: entry.summary_overall_points,
          summary_overall_rank: entry.summary_overall_rank ?? null,
          summary_event_points: entry.summary_event_points,
          current_event: entry.current_event ?? null,
          last_deadline_bank: entry.last_deadline_bank ?? null,
          last_deadline_value: entry.last_deadline_value ?? null,
        },
        leagues: (entry.leagues?.classic ?? []).map((l) => ({
          id: l.id,
          name: l.name,
          entry_rank: l.entry_rank ?? null,
          entry_last_rank: l.entry_last_rank ?? null,
        })),
        history: history.current ?? [],
        chips: history.chips ?? [],
        stale,
        fetchedAt,
      };
    } catch (error) {
      if (error instanceof FplError && error.status === 404) {
        throw new Error(`No FPL team found with ID ${teamId}. Double-check the number.`);
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
    const { cached, fplFetch, TTL, FplError } = await import("./fpl/api.server");
    const { teamId, gameweek } = input;

    type Bs = Bootstrap;
    const bootstrap = await cached<Bs>("bootstrap", TTL.bootstrap, () =>
      fplFetch<Bs>("/bootstrap-static/"),
    );

    const currentEvent = bootstrap.data.events.find((e) => e.is_current)?.id ?? 0;
    const ttl = gameweek < currentEvent ? TTL.picksPast : TTL.picksLive;

    try {
      const { data, fetchedAt, stale } = await cached<{
        picks: {
          element: number;
          position: number;
          multiplier: number;
          is_captain: boolean;
          is_vice_captain: boolean;
        }[];
      }>(`picks:${teamId}:${gameweek}`, ttl, () =>
        fplFetch(`/entry/${teamId}/event/${gameweek}/picks/`),
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
          price: el ? el.now_cost / 10 : 0,
          points: (el?.event_points ?? 0) * Math.max(p.multiplier, 1),
          multiplier: p.multiplier,
          isCaptain: p.is_captain,
          isViceCaptain: p.is_vice_captain,
          onBench: p.position > 11,
        };
      });

      return { gameweek, picks, available: true, stale, fetchedAt };
    } catch (error) {
      const message =
        error instanceof FplError && error.status === 404
          ? "This gameweek's squad isn't public yet — it appears after the deadline."
          : "Couldn't load the squad for this gameweek.";
      return {
        gameweek,
        picks: [],
        available: false,
        message,
        stale: false,
        fetchedAt: new Date().toISOString(),
      };
    }
  });
