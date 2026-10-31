import { cached, fplFetch } from './api.server';
import { MODEL } from './config';
import { snapshotDeltas, type PlayerHistory } from './recency';
const numeric = (v: unknown) => Number(v) || 0;
export async function loadPlayerHistory(playerId: number): Promise<{history: PlayerHistory[]; source: 'official' | 'snapshots' | 'season'}> {
  const result = await cached<{history: PlayerHistory[]; complete: boolean}>(`draft:player-history:${playerId}`, MODEL.historyTtl, async () => {
    try {
      const raw = await fplFetch<{history?: Record<string, unknown>[]}>(`/element-summary/${playerId}`, 1);
      const rows = raw.history ?? [];
      return { complete: rows.length > 0 && rows.every(r => r['minutes'] !== undefined && r['expected_goals'] !== undefined && r['expected_assists'] !== undefined), history: rows.map(r=>({event:numeric(r['event'] ?? r['round']),minutes:numeric(r['minutes']),xg:numeric(r['expected_goals']),xa:numeric(r['expected_assists']),points:numeric(r['total_points']),bonus:numeric(r['bonus']),saves:numeric(r['saves']),defensiveContribution:numeric(r['defensive_contribution']),goals:numeric(r['goals_scored']),assists:numeric(r['assists']),yellowCards:numeric(r['yellow_cards']),redCards:numeric(r['red_cards'])})) };
    } catch { return {history:[], complete:false}; }
  });
  if (result.data.complete) return {history:result.data.history,source:'official'};
  const {supabaseAdmin} = await import('@/integrations/supabase/client.server');
  const {data,error} = await supabaseAdmin.from('player_snapshots').select('*').eq('player_id',playerId).order('gw',{ascending:false}).limit(MODEL.recentWindow+1);
  const deltas = !error && data ? snapshotDeltas(data.map(r=>({...r,xg:Number(r.xg),xa:Number(r.xa)}))) : [];
  return {history:deltas,source:deltas.length ? 'snapshots':'season'};
}
export async function mapWithConcurrency<T,R>(items:T[], fn:(item:T)=>Promise<R>):Promise<R[]> {
  const result:R[]=[];
  for(let i=0;i<items.length;i+=MODEL.concurrency) result.push(...await Promise.all(items.slice(i,i+MODEL.concurrency).map(fn)));
  return result;
}
