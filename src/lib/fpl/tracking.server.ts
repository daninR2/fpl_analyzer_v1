import { fplFetch } from './api.server';
import { MODEL } from './config';
import { loadPlayerHistory, mapWithConcurrency } from './history.server';
import { projectPlayers, type RawElement,type RawFixture } from './projections';
import type {Bootstrap} from './types';
/** Called only after cron authentication; never from public page loads. */
export async function trackModel(){
 const {supabaseAdmin}=await import('@/integrations/supabase/client.server');
 const bs=await fplFetch<Omit<Bootstrap,"elements"> & {elements:RawElement[];fixtures:Record<string,RawFixture[]>}>('/bootstrap-static');
 const current=bs.events.current??0;if(!current)return {snapshots:0,logged:0,scored:0};
 const check=(error:unknown)=>{if(error)throw new Error('Model tracking storage failed.');};
 const snapshots=bs.elements.map(e=>({player_id:e.id,gw:current,minutes:e.minutes,xg:Number(e.expected_goals)||0,xa:Number(e.expected_assists)||0,points:e.total_points,bonus:e.bonus,saves:e.saves,defensive_contribution:e.defensive_contribution??0,goals:e.goals_scored,assists:e.assists,yellow_cards:e.yellow_cards,red_cards:e.red_cards??0,taken_at:new Date().toISOString()}));
 for(let i=0;i<snapshots.length;i+=200){const {error}=await supabaseAdmin.from('player_snapshots').upsert(snapshots.slice(i,i+200),{onConflict:'player_id,gw'});check(error);}
 // Save only pre-kickoff predictions. If first observed mid-GW, skip, never backfill.
 const fixtures=Object.values(bs.fixtures??{}).flat(),eventFixtures=fixtures.filter(f=>f.event===current);
 const kickoff=eventFixtures.map(f=>f.kickoff_time?+new Date(f.kickoff_time):NaN).filter(Number.isFinite);
 const canLog=kickoff.length>0&&Date.now()<Math.min(...kickoff);
 let logged=0,scored=0;
 if(canLog){
 const existing=await supabaseAdmin.from('projection_log').select('player_id').eq('gw',current);check(existing.error);
 const ids=new Set(existing.data?.map(r=>r.player_id));
 const missing=bs.elements.filter(e=>!ids.has(e.id));
 if(missing.length){const history=await mapWithConcurrency(missing.map(e=>e.id),async id=>({id,...await loadPlayerHistory(id)}));
 const finished=bs.events.data.filter(e=>e.finished).length;
 const projections=projectPlayers({elements:bs.elements,teams:bs.teams,fixtures,events:[current],gamesPlayed:finished,deadlines:bs.events.data,histories:new Map(history.map(h=>[h.id,h.history]))}).players;
 const logs=missing.flatMap(e=>{const p=projections.get(e.id),h=history.find(h=>h.id===e.id)?.history.filter(h=>h.event<current).sort((a,b)=>b.event-a.event).slice(0,5);if(!p)return [];return [{gw:current,player_id:e.id,position_id:e.element_type,xpts:p.byEvent[current]??0,pred_p60:p.p60ByEvent?.[current]??0,predicted_sd:p.sd??0,baseline_form:h?.length?h.reduce((s,r)=>s+r.points,0)/h.length:Number(e.form)||0,baseline_ppg:Number(e.points_per_game)||0,model_version:MODEL.version}];});
 const {error}=await supabaseAdmin.from('projection_log').upsert(logs,{onConflict:'gw,player_id',ignoreDuplicates:true});check(error);logged=logs.length;
 }}
 const finishedIds=bs.events.data.filter(e=>e.finished).map(e=>e.id);
 if(finishedIds.length){const pending=await supabaseAdmin.from('projection_log').select('gw,player_id').in('gw',finishedIds).is('actual_points',null).limit(2000);check(pending.error);
 const ids=[...new Set(pending.data?.map(r=>r.player_id))];
 const histories=await mapWithConcurrency(ids,async id=>({id,...await loadPlayerHistory(id)}));
 for(const row of pending.data??[]){const h=histories.find(h=>h.id===row.player_id)?.history.filter(h=>h.event===row.gw);if(!h?.length)continue;
 const {error}=await supabaseAdmin.from('projection_log').update({actual_points:h.reduce((s,r)=>s+r.points,0),actual_p60:Number(h.reduce((s,r)=>s+r.minutes,0)>=60),scored_at:new Date().toISOString()}).eq('gw',row.gw).eq('player_id',row.player_id).is('actual_points',null);check(error);scored++;}}
 return {snapshots:snapshots.length,logged,scored};
}
