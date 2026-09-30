// Shared Draft FPL domain types (client-safe).

export type FplElement = {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number;
  total_points: number;
  event_points: number;
  form: string;
  points_per_game: string;
  status: string;
  news?: string;
};

export type FplTeam = { id: number; name: string; short_name: string };
export type FplElementType = { id: number; singular_name_short: string; plural_name: string };
export type FplEvent = {
  id: number;
  name: string;
  finished: boolean;
  deadline_time: string;
};

export type Bootstrap = {
  elements: FplElement[];
  teams: FplTeam[];
  element_types: FplElementType[];
  events: { current: number | null; next: number | null; data: FplEvent[] };
};

export type HistoryEntry = {
  event: number;
  points: number;
  total_points: number;
  points_on_bench: number;
  event_transfers: number;
};

export type ManagerInfo = {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  overall_points: number;
  event_points: number;
  leagueId: number | null;
  currentEvent: number | null;
};

export type ManagerLeagueSummary = {
  id: number;
  name: string;
  rank: number | null;
  won: number;
  drawn: number;
  lost: number;
  total: number;
  entries: number;
};

export type ManagerPayload = {
  manager: ManagerInfo;
  league: ManagerLeagueSummary | null;
  history: HistoryEntry[];
  stale: boolean;
  fetchedAt: string;
};

export type SquadPick = {
  playerId: number;
  name: string;
  team: string;
  position: string;
  positionId: number;
  points: number;
  onBench: boolean;
};

export type PicksPayload = {
  gameweek: number;
  picks: SquadPick[];
  available: boolean;
  message?: string;
  stale: boolean;
  fetchedAt: string;
};

export type StandingRow = {
  rank: number;
  lastRank: number | null;
  entryId: number;
  teamName: string;
  managerName: string;
  won: number;
  drawn: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  total: number;
};

export type H2HMatch = {
  event: number;
  finished: boolean;
  started: boolean;
  home: { entryId: number; teamName: string; points: number };
  away: { entryId: number; teamName: string; points: number };
};

export type LeaguePayload = {
  id: number;
  name: string;
  scoring: "h2h" | "classic";
  currentEvent: number | null;
  standings: StandingRow[];
  matches: H2HMatch[];
  stale: boolean;
  fetchedAt: string;
};

export type FreeAgent = {
  playerId: number;
  name: string;
  team: string;
  position: string;
  positionId: number;
  totalPoints: number;
  form: number;
  pointsPerGame: number;
  status: string;
  news: string;
};

export type FreeAgentsPayload = {
  players: FreeAgent[];
  stale: boolean;
  fetchedAt: string;
};

export type InsightPlayer = {
  playerId: number;
  name: string;
  team: string;
  position: string;
  positionId: number;
  availability: number;
  news: string;
  form: number;
  xg90: number;
  xa90: number;
  minutesShare: number;
  byEvent: Record<number, number>;
  fixtures: { event: number; opponent: string; home: boolean; difficulty: 1 | 2 | 3 | 4 | 5; xPts: number }[];
  total: number;
};

export type MatchupSide = {
  entryId: number;
  teamName: string;
  expected: number;
  starters: InsightPlayer[];
};

export type Matchup = {
  event: number;
  me: MatchupSide;
  opponent: MatchupSide | null;
  winProbability: number | null;
};

export type Recommendation = {
  add: InsightPlayer;
  drop: InsightPlayer;
  gain: number;
  reasons: string[];
};

export type InsightsPayload = {
  teamName: string;
  leagueId: number;
  events: number[];
  squad: InsightPlayer[];
  matchups: Matchup[];
  recommendations: Recommendation[];
  topFreeAgents: InsightPlayer[];
  fetchedAt: string;
};
