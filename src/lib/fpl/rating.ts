import { bestEleven } from './projections';
import type { InsightPlayer, TeamRating } from './types';

/** Fit-player quality per gameweek: healthy long-term value, ignoring current injuries and luck. */
export const quality = (p: InsightPlayer, games: number) =>
  (p.healthyHoldValue ?? p.healthyTotal) / Math.max(1, games);

/** Rates each squad on player quality (best XI 85%, bench depth 15%), scaled so the league's best is 100. */
export function rateTeams(teams: { entryId: number; teamName: string; squad: InsightPlayer[] }[], games: number): TeamRating[] {
  const raw = teams.map((t) => {
    const scored = t.squad.map((p) => ({ ...p, byEvent: { [-1]: quality(p, games) } }));
    const xi = bestEleven(scored, -1);
    const ids = new Set(xi.map((p) => p.playerId));
    const xiValue = xi.reduce((s, p) => s + (p.byEvent[-1] ?? 0), 0);
    const benchValue = scored.filter((p) => !ids.has(p.playerId)).reduce((s, p) => s + (p.byEvent[-1] ?? 0), 0);
    const lines = [1, 2, 3, 4].map((pos) => xi.filter((p) => p.positionId === pos).reduce((s, p) => s + (p.byEvent[-1] ?? 0), 0));
    const star = [...scored].sort((a, b) => (b.byEvent[-1] ?? 0) - (a.byEvent[-1] ?? 0))[0];
    return { entryId: t.entryId, teamName: t.teamName, score: xiValue * 0.85 + benchValue * 0.15, xiValue, benchValue, lines, star: star?.name ?? '—' };
  });
  const max = Math.max(...raw.map((r) => r.score), 1e-9);
  const lineMax = [0, 1, 2, 3].map((i) => Math.max(...raw.map((r) => r.lines[i] ?? 0), 1e-9));
  return raw
    .sort((a, b) => b.score - a.score)
    .map((r, i) => ({
      entryId: r.entryId,
      teamName: r.teamName,
      rank: i + 1,
      rating: Math.round((100 * r.score) / max),
      xiPerGw: Math.round(r.xiValue * 10) / 10,
      benchPerGw: Math.round(r.benchValue * 10) / 10,
      lines: { gk: Math.round((100 * r.lines[0]!) / lineMax[0]!), def: Math.round((100 * r.lines[1]!) / lineMax[1]!), mid: Math.round((100 * r.lines[2]!) / lineMax[2]!), fwd: Math.round((100 * r.lines[3]!) / lineMax[3]!) },
      star: r.star,
    }));
}
