import { useEffect, useState } from "react";

const KEY = "fpl-league-hub:team-id";

export function readStoredTeamId(): string | null {
  try {
    return window.localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function storeTeamId(teamId: string) {
  try {
    window.localStorage.setItem(KEY, teamId);
  } catch {
    /* storage unavailable — ignore */
  }
}

export function clearStoredTeamId() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable — ignore */
  }
}

/** Reads the stored team ID after hydration (null on the server). */
export function useStoredTeamId(): string | null {
  const [teamId, setTeamId] = useState<string | null>(null);
  useEffect(() => {
    setTeamId(readStoredTeamId());
  }, []);
  return teamId;
}
