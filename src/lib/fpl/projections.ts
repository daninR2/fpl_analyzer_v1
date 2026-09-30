// Expected-points model for Draft FPL. Pure functions, no I/O.
//
// Team strength comes from aggregated player data (team xG per game, and
// goalkeeper xGC per 90). Each player's per-90 rates are shrunk toward a
// positional prior so low-minute players don't look like superstars, then
// scaled by the attacking/defensive strength of each upcoming opponent.

import priorSeason from "./prior-2025-26.json";

export type RawElement = {
  id: number;
  code: number;
  web_name: string;
  team: number;
  element_type: number;
  status: string;
  news?: string;
  minutes: number;
  starts?: number;
  total_points: number;
  form: string;
  points_per_game: string;
  expected_goals: string;
  expected_assists: string;
  expected_goal_involvements: string;
  expected_goals_conceded: string;
  goals_scored: number;
  assists: number;
  saves: number;
  bonus: number;
  yellow_cards: number;
  defensive_contribution?: number;
  chance_of_playing_next_round: number | null;
  penalties_order?: number | null;
};

export type RawFixture = {
  id: number;
  event: number;
  team_h: number;
  team_a: number;
  kickoff_time: string | null;
};

export type FixtureProjection = {
  event: number;
  opponent: string;
  home: boolean;
  difficulty: 1 | 2 | 3 | 4 | 5;
  xPts: number;
};

export type PlayerProjection = {
  playerId: number;
  name: string;
  team: string;
  teamId: number;
  position: string;
  positionId: number;
  availability: number;
  news: string;
  form: number;
  totalPoints: number;
  xg90: number;
  xa90: number;
  minutesShare: number;
  byEvent: Record<number, number>;
  fixtures: FixtureProjection[];
  total: number;
  established: boolean;
};

const POS = ["", "GKP", "DEF", "MID", "FWD"];
const GOAL_PTS = [0, 10, 6, 5, 4];
const CS_PTS = [0, 4, 4, 1, 0];
const XG_PRIOR = [0, 0.005, 0.04, 0.12, 0.3];
const XA_PRIOR = [0, 0.01, 0.05, 0.12, 0.1];
const DC_THRESHOLD = [0, 99, 10, 12, 12];
const HOME_ADV = 1.1;

const num = (v: string | number | null | undefined) => {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
};
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

function poissonAtLeast(mean: number, k: number) {
  if (mean <= 0) return 0;
  let term = Math.exp(-mean);
  let cdf = term;
  for (let i = 1; i < k; i++) {
    term *= mean / i;
    cdf += term;
  }
  return clamp(1 - cdf, 0, 1);
}

export function availability(el: RawElement) {
  const chance = el.chance_of_playing_next_round;
  if (chance !== null && chance !== undefined) return chance / 100;
  return ["i", "s", "u", "n"].includes(el.status) ? 0 : 1;
}

type TeamStrength = { attack: number; defence: number };

type PriorPlayer = { minutes: number; points: number; xg: number; xa: number; xgc: number; cs: number };
type PriorTeam = { xgPerGame: number; xgaPerGame: number; cleanSheets: number };
const playerPriors = priorSeason.players as Record<string, PriorPlayer>;
const teamPriors = priorSeason.teams as Record<string, PriorTeam>;

function teamStrengths(elements: RawElement[], gamesPlayed: number, teamNames: Map<number, string>) {
  const xg = new Map<number, number>();
  const gkXgc = new Map<number, number>();
  const gkMins = new Map<number, number>();
  for (const e of elements) {
    xg.set(e.team, (xg.get(e.team) ?? 0) + num(e.expected_goals));
    if (e.element_type === 1) {
      gkXgc.set(e.team, (gkXgc.get(e.team) ?? 0) + num(e.expected_goals_conceded));
      gkMins.set(e.team, (gkMins.get(e.team) ?? 0) + e.minutes);
    }
  }
  const teams = [...new Set(elements.map((e) => e.team))];
  const raw = teams.map((t) => ({
    t,
    attack: (xg.get(t) ?? 0) / Math.max(gamesPlayed, 1),
    defence: (gkXgc.get(t) ?? 0) / Math.max((gkMins.get(t) ?? 0) / 90, 1),
  }));
  const avgA = raw.reduce((s, r) => s + r.attack, 0) / Math.max(raw.length, 1) || 1.35;
  const avgD = raw.reduce((s, r) => s + r.defence, 0) / Math.max(raw.length, 1) || 1.35;
  // The completed 2025/26 season supplies an eight-match prior. This prevents a
  // handful of early results from treating proven defences like average teams.
  const w = gamesPlayed / (gamesPlayed + 8);
  const map = new Map<number, TeamStrength>();
  for (const r of raw) {
    const prior = teamPriors[teamNames.get(r.t) ?? ""];
    const priorAttack = prior?.xgPerGame ?? avgA;
    const priorDefence = prior?.xgaPerGame ?? avgD;
    map.set(r.t, {
      attack: w * (r.attack || avgA) + (1 - w) * priorAttack,
      defence: w * (r.defence || avgD) + (1 - w) * priorDefence,
    });
  }
  return { map, avgA, avgD };
}

export function projectPlayers(opts: {
  elements: RawElement[];
  teams: { id: number; short_name: string }[];
  fixtures: RawFixture[];
  events: number[];
  gamesPlayed: number;
}): { players: Map<number, PlayerProjection>; teamDifficulty: Map<string, number> } {
  const { elements, fixtures, events, gamesPlayed } = opts;
  const teamName = new Map(opts.teams.map((t) => [t.id, t.short_name]));
  const { map: strength, avgA, avgD } = teamStrengths(elements, gamesPlayed, teamName);
  const gp = Math.max(gamesPlayed, 1);

  // Per-fixture team goal expectations
  type Fx = { event: number; opp: number; home: boolean; lamFor: number; lamAgainst: number };
  const byTeam = new Map<number, Fx[]>();
  const teamDifficulty = new Map<string, number>();
  for (const f of fixtures) {
    if (!events.includes(f.event)) continue;
    const h = strength.get(f.team_h)!;
    const a = strength.get(f.team_a)!;
    if (!h || !a) continue;
    const lamH = h.attack * (a.defence / avgD) * HOME_ADV;
    const lamA = a.attack * (h.defence / avgD) / HOME_ADV;
    const push = (team: number, fx: Fx) => byTeam.set(team, [...(byTeam.get(team) ?? []), fx]);
    push(f.team_h, { event: f.event, opp: f.team_a, home: true, lamFor: lamH, lamAgainst: lamA });
    push(f.team_a, { event: f.event, opp: f.team_h, home: false, lamFor: lamA, lamAgainst: lamH });
  }

  const difficultyOf = (fx: Fx): 1 | 2 | 3 | 4 | 5 => {
    // Net expected goal difference -> 1 (easy) .. 5 (hard)
    const diff = fx.lamFor - fx.lamAgainst;
    if (diff > 0.8) return 1;
    if (diff > 0.25) return 2;
    if (diff > -0.25) return 3;
    if (diff > -0.8) return 4;
    return 5;
  };

  const players = new Map<number, PlayerProjection>();
  for (const e of elements) {
    const pos = e.element_type;
    const mins = e.minutes;
    const nineties = mins / 90;
    const prior = playerPriors[String(e.code)];
    const priorNineties = Math.min((prior?.minutes ?? 0) / 90, 8);
    const priorXg90 = prior && prior.minutes > 0 ? (prior.xg / prior.minutes) * 90 : XG_PRIOR[pos]!;
    const priorXa90 = prior && prior.minutes > 0 ? (prior.xa / prior.minutes) * 90 : XA_PRIOR[pos]!;
    const xg90 = (num(e.expected_goals) + priorXg90 * priorNineties + XG_PRIOR[pos]! * 2) / (nineties + priorNineties + 2);
    const xa90 = (num(e.expected_assists) + priorXa90 * priorNineties + XA_PRIOR[pos]! * 2) / (nineties + priorNineties + 2);
    const minutesShare = clamp(mins / (gp * 90), 0, 1);
    const play60 = clamp((minutesShare - 0.3) / 0.5, 0, 1);
    const avail = availability(e);
    const saves90 = nineties > 0 ? e.saves / nineties : pos === 1 ? 2.5 : 0;
    const bonusPg = e.bonus / gp;
    const dc90 = nineties > 0 ? num(e.defensive_contribution) / nineties : 0;
    const yellowPg = e.yellow_cards / gp;
    const currentPpg = num(e.points_per_game);
    const priorPpg = prior && prior.minutes >= 450 ? prior.points / Math.max(prior.minutes / 90, 1) : currentPpg;
    const ppg = nineties > 0 ? (currentPpg * nineties + priorPpg * priorNineties) / (nineties + priorNineties) : priorPpg;
    const own = strength.get(e.team);

    const fixturesOut: FixtureProjection[] = [];
    const byEvent: Record<number, number> = {};
    for (const ev of events) byEvent[ev] = 0;

    for (const fx of byTeam.get(e.team) ?? []) {
      const attackRatio = own ? fx.lamFor / own.attack : 1;
      const expGoals = xg90 * attackRatio * minutesShare;
      const expAssists = xa90 * attackRatio * minutesShare;
      const pCS = Math.exp(-fx.lamAgainst) * play60;
      const app = minutesShare > 0 ? 1 + play60 : 0;

      let pts =
        app +
        expGoals * GOAL_PTS[pos]! +
        expAssists * 3 +
        pCS * CS_PTS[pos]! +
        bonusPg * clamp(attackRatio, 0.7, 1.3) -
        yellowPg;
      if (pos <= 2) pts -= (fx.lamAgainst / 2) * 0.8 * play60;
      if (pos === 1) pts += ((saves90 * (fx.lamAgainst / avgA)) / 3) * minutesShare;
      if (pos >= 2) pts += 2 * poissonAtLeast(dc90, DC_THRESHOLD[pos]!) * play60;

      // Light blend with actual points-per-game to capture what the model misses.
      if (mins >= 180) pts = 0.85 * pts + 0.15 * ppg * clamp(attackRatio, 0.8, 1.2);
      pts = Math.max(0, pts * avail);

      byEvent[fx.event] = (byEvent[fx.event] ?? 0) + pts;
      const d = difficultyOf(fx);
      fixturesOut.push({
        event: fx.event,
        opponent: teamName.get(fx.opp) ?? "?",
        home: fx.home,
        difficulty: d,
        xPts: round(pts),
      });
    }
    for (const ev of events) byEvent[ev] = round(byEvent[ev] ?? 0);

    players.set(e.id, {
      playerId: e.id,
      name: e.web_name,
      team: teamName.get(e.team) ?? "",
      teamId: e.team,
      position: POS[pos] ?? "",
      positionId: pos,
      availability: avail,
      news: e.news ?? "",
      form: num(e.form),
      totalPoints: e.total_points,
      xg90: round(xg90, 2),
      xa90: round(xa90, 2),
      minutesShare: round(minutesShare, 2),
      byEvent,
      fixtures: fixturesOut.sort((a, b) => a.event - b.event),
      total: round(Object.values(byEvent).reduce((s, v) => s + v, 0)),
      established:
        !!prior &&
        prior.minutes >= 1_200 &&
        prior.points >= ([0, 85, 90, 100, 95][pos] ?? 100),
    });
  }
  for (const [t, s] of strength) teamDifficulty.set(teamName.get(t) ?? "", round(s.attack - s.defence, 2));
  return { players, teamDifficulty };
}

export function round(n: number, dp = 1) {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

/** Best valid XI (1 GK, 3-5 DEF, 2-5 MID, 1-3 FWD) for a given event. */
export function bestEleven(players: PlayerProjection[], event: number) {
  const by = (id: number) =>
    players.filter((p) => p.positionId === id).sort((a, b) => (b.byEvent[event] ?? 0) - (a.byEvent[event] ?? 0));
  const gk = by(1).slice(0, 1);
  const def = by(2);
  const mid = by(3);
  const fwd = by(4);
  const xi = [...gk, ...def.slice(0, 3), ...mid.slice(0, 2), ...fwd.slice(0, 1)];
  const rest = [...def.slice(3, 5), ...mid.slice(2, 5), ...fwd.slice(1, 3)].sort(
    (a, b) => (b.byEvent[event] ?? 0) - (a.byEvent[event] ?? 0),
  );
  xi.push(...rest.slice(0, 11 - xi.length));
  return xi;
}

/** Probability A beats B given expected totals (normal approximation). */
export function winProbability(a: number, b: number) {
  const sd = Math.sqrt(2) * 13;
  const z = (a - b) / sd;
  // erf approximation
  const t = 1 / (1 + 0.3275911 * Math.abs(z / Math.SQRT2));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-((z / Math.SQRT2) ** 2));
  const erf = z >= 0 ? y : -y;
  return clamp(0.5 * (1 + erf), 0.01, 0.99);
}
