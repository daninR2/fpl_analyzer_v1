import { MODEL } from './config';
export type PlayerHistory = { event: number; minutes: number; xg: number; xa: number; points: number; bonus: number; saves: number; defensiveContribution: number; goals: number; assists: number; yellowCards: number; redCards: number; fit?: boolean };
export type RecentStats = { nEff: number; nineties: number; xg90: number; xa90: number; bonus: number; saves90: number; dc90: number; yellow90: number; red90: number; ppg: number; p60: number; pb: number; p0: number; luck: number; count: number };
export function recentStats(history: PlayerHistory[], latest: number): RecentStats {
  const grouped = new Map<number, PlayerHistory>();
  for (const h of history.filter(h => h.event <= latest && h.event > latest - MODEL.recentWindow)) {
    const old = grouped.get(h.event);
    if (!old) grouped.set(h.event, { ...h });
    else { for (const key of ['minutes','xg','xa','points','bonus','saves','defensiveContribution','goals','assists','yellowCards','redCards'] as const) old[key] += h[key]; }
  }
  let weight = 0, squares = 0, minutes = 0, xg = 0, xa = 0, bonus = 0, saves = 0, dc = 0, yc = 0, rc = 0, points = 0, p60 = 0, pb = 0, luck = 0;
  for (const h of grouped.values()) {
    const w = MODEL.recencyDecay ** (latest - h.event);
    // Known injury absences must not be interpreted as losing a starting role.
    if (h.fit !== false) { weight += w; squares += w*w; p60 += w * Number(h.minutes >= 60); pb += w * Number(h.minutes > 0 && h.minutes < 60); }
    minutes += w*h.minutes; xg += w*h.xg; xa += w*h.xa; bonus += w*h.bonus; saves += w*h.saves; dc += w*h.defensiveContribution; yc += w*h.yellowCards; rc += w*h.redCards; points += w*h.points;
    luck += h.goals + h.assists - h.xg - h.xa;
  }
  const nineties = minutes/90, den = weight || 1, rateDen = nineties || 1;
  return { nEff: squares ? weight*weight/squares : 0, nineties, xg90: xg/rateDen, xa90: xa/rateDen, bonus: bonus/den, saves90: saves/rateDen, dc90: dc/rateDen, yellow90: yc/rateDen, red90: rc/rateDen, ppg: points/den, p60: p60/den, pb: pb/den, p0: weight ? 1-(p60+pb)/den : 1, luck, count: grouped.size };
}
/** Snapshot rows are cumulative season totals. Never invent the first observed GW. */
export function snapshotDeltas(rows: {gw:number; minutes:number; xg:number; xa:number; points:number; bonus:number; saves:number; defensive_contribution:number; goals:number; assists:number; yellow_cards:number; red_cards:number}[]): PlayerHistory[] {
  const sorted = [...rows].sort((a,b)=>a.gw-b.gw);
  return sorted.flatMap((r,i) => {
    const prev = sorted[i-1];
    if (!prev || r.gw !== prev.gw+1 || r.minutes < prev.minutes) return [];
    return [{event:r.gw, minutes:r.minutes-prev.minutes, xg:r.xg-prev.xg, xa:r.xa-prev.xa, points:r.points-prev.points, bonus:r.bonus-prev.bonus, saves:r.saves-prev.saves, defensiveContribution:r.defensive_contribution-prev.defensive_contribution, goals:r.goals-prev.goals, assists:r.assists-prev.assists, yellowCards:r.yellow_cards-prev.yellow_cards, redCards:r.red_cards-prev.red_cards}];
  });
}
