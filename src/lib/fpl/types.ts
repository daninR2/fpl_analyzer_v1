// Shared FPL domain types (client-safe).

export type FplElement = {
  id: number;
  web_name: string;
  first_name: string;
  second_name: string;
  team: number;
  element_type: number;
  now_cost: number;
  total_points: number;
  event_points: number;
  form: string;
  points_per_game: string;
  selected_by_percent: string;
  ict_index: string;
  chance_of_playing_next_round: number | null;
  status: string;
};

export type FplTeam = { id: number; name: string; short_name: string };
export type FplElementType = { id: number; singular_name_short: string; plural_name: string };
export type FplEvent = {
  id: number;
  name: string;
  is_current: boolean;
  is_next: boolean;
  finished: boolean;
  deadline_time: string;
};

export type Bootstrap = {
  elements: FplElement[];
  teams: FplTeam[];
  element_types: FplElementType[];
  events: FplEvent[];
};

export type ManagerLeague = {
  id: number;
  name: string;
  entry_rank: number | null;
  entry_last_rank: number | null;
};

export type ManagerInfo = {
  id: number;
  name: string;
  player_first_name: string;
  player_last_name: string;
  summary_overall_points: number;
  summary_overall_rank: number | null;
  summary_event_points: number;
  current_event: number | null;
  last_deadline_bank: number | null;
  last_deadline_value: number | null;
};

export type HistoryEntry = {
  event: number;
  points: number;
  total_points: number;
  rank: number | null;
  overall_rank: number | null;
  event_transfers: number;
  event_transfers_cost: number;
  points_on_bench: number;
};

export type ChipPlay = { name: string; event: number };

export type ManagerPayload = {
  manager: ManagerInfo;
  leagues: ManagerLeague[];
  history: HistoryEntry[];
  chips: ChipPlay[];
  stale: boolean;
  fetchedAt: string;
};

export type SquadPick = {
  playerId: number;
  name: string;
  team: string;
  position: string;
  positionId: number;
  price: number;
  points: number;
  multiplier: number;
  isCaptain: boolean;
  isViceCaptain: boolean;
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

export type BootstrapPayload = {
  teams: FplTeam[];
  events: FplEvent[];
  currentEvent: number | null;
  stale: boolean;
  fetchedAt: string;
};
