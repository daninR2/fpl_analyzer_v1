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
  leagueHistory: LeagueHistoryTeam[];
  stale: boolean;
  fetchedAt: string;
};

export type LeagueHistoryPoint = {
  event: number;
  points: number;
  totalPoints: number;
  recordPoints: number;
  record: string;
};

export type LeagueHistoryTeam = {
  entryId: number;
  teamName: string;
  isCurrentTeam: boolean;
  history: LeagueHistoryPoint[];
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
  established: boolean;
  healthyTotal: number;
  isNew: boolean;
  priorInjured: boolean;
  injury: { returnDate: string | null } | null;
  availabilityByEvent?: Record<number, number>;
  varianceByEvent?: Record<number, number>;
  sdByEvent?: Record<number, number>;
  p60ByEvent?: Record<number, number>;
  healthyByEvent?: Record<number, number>;
  sd?: number;
  recentLuck?: number;
  recentPpg?: number;
  historySource?: string;
  minutesStable?: boolean;
  nowValue?: number;
  holdValue?: number;
  healthyHoldValue?: number;
  vorp?: number;
  healthyVorp?: number;
  holdVerdict?: string;
  holdReason?: string;
  buyLow?: boolean;
  contenders?: number;
};

export type MatchupSide = {
  entryId: number;
  teamName: string;
  expected: number;
  starters: InsightPlayer[];
  sd?: number;
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
  caution: string | null;
  confidence?: number;
  winProbabilityDeltas?: { event: number; delta: number }[];
};

export type Stash = {
  add: InsightPlayer;
  drop: InsightPlayer | null;
  need: "high" | "medium";
  /** Expected points per gameweek over your current starter once fit. */
  gainPerGw: number;
  reason: string;
};

export type InsightsPayload = {
  stashes: Stash[];
  holdEvents?: number[];
  longTermRecommendations?: Recommendation[];
  trades?: TradeIdea[];
  rivalBuyLows?: { teamName: string; player: InsightPlayer }[];
  teamRatings?: TeamRating[];
  dataCoverage?: { official: number; snapshots: number; season: number };
  teamName: string;
  leagueId: number;
  events: number[];
  squad: InsightPlayer[];
  matchups: Matchup[];
  recommendations: Recommendation[];
  topFreeAgents: InsightPlayer[];
  fetchedAt: string;
};

export type TradeIdea = { rivalEntryId: number; rivalTeamName: string; give: InsightPlayer; receive: InsightPlayer; myGain: number; theirGain: number };

export type TeamRating = { entryId: number; teamName: string; rank: number; rating: number; xiPerGw: number; benchPerGw: number; lines: { gk: number; def: number; mid: number; fwd: number }; star: string };
