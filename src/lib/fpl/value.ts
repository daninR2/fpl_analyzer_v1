import {MODEL} from './config';
import {normalCdf} from './math';
import {optimizeLineup} from './lineup';
import type {InsightPlayer,Recommendation,TradeIdea,Matchup} from './types';
export function playerValue(p:InsightPlayer,events:number[],healthy=false){return events.reduce((s,ev,i)=>s+MODEL.discount**i*((healthy?p.healthyByEvent:p.byEvent)?.[ev]??0),0);}
export function horizonVariance(p:InsightPlayer,events:number[]){return events.reduce((s,ev,i)=>s+MODEL.discount**(2*i)*(p.varianceByEvent?.[ev]??0),0);}
export function teamValue(squad:InsightPlayer[],events:number[]){return events.reduce((sum,ev,i)=>{
 const {xi,bench}=optimizeLineup(squad,ev),starterPts=xi.reduce((s,p)=>s+(p.byEvent[ev]??0),0);
 const benchPts=bench.reduce((s,p)=>{const starters=xi.filter(x=>x.positionId===p.positionId);const trigger=1-starters.reduce((v,x)=>v*(x.availabilityByEvent?.[ev]??x.availability),1);return s+(p.byEvent[ev]??0)*trigger;},0);
 return sum+MODEL.discount**i*(starterPts+MODEL.benchWeight*benchPts);
 },0);}
export function swapped(squad:InsightPlayer[],drop:InsightPlayer,add:InsightPlayer){return squad.map(p=>p.playerId===drop.playerId?add:p);}
export function swapGain(squad:InsightPlayer[],drop:InsightPlayer,add:InsightPlayer,events:number[]){if(drop.positionId!==add.positionId)return -Infinity;return teamValue(swapped(squad,drop,add),events)-teamValue(squad,events);}
export function swapConfidence(gain:number,add:InsightPlayer,drop:InsightPlayer,events:number[]){const sd=Math.sqrt(horizonVariance(add,events)+horizonVariance(drop,events));return sd>0?normalCdf(gain/sd):gain===0?.5:gain>0?1:0;}
export function protectedDrop(p:InsightPlayer,gamesPlayed:number,horizon:number){
 return (gamesPlayed<=MODEL.establishedGrace&&(p.established||p.priorInjured)&&p.availability>=.25)||(p.isNew&&gamesPlayed<MODEL.arrivalGrace)||!!(p.injury&&(p.established||p.priorInjured)&&p.healthyTotal>=horizon*([0,3,3,3.5,3.5][p.positionId]??3.5));
}
export function gate(gain:number,confidence:number,pos:number){return gain>=(MODEL.gainThreshold[pos]??.75)&&confidence>=MODEL.confidenceThreshold;}
export function replacementLevels(freeAgents:InsightPlayer[],events:number[]){const levels=new Map<number,number>();for(let pos=1;pos<=4;pos++){const sorted=freeAgents.filter(p=>p.positionId===pos).map(p=>playerValue(p,events)).sort((a,b)=>b-a);levels.set(pos,sorted[MODEL.replacementRank-1]??sorted[0]??0);}return levels;}
export function annotatePlayers(all:InsightPlayer[],freeAgents:InsightPlayer[],events:number[],gamesPlayed:number){
 const levels=replacementLevels(freeAgents,events);
 for(const p of all){p.nowValue=playerValue(p,events.slice(0,MODEL.nowHorizon));p.holdValue=playerValue(p,events);p.healthyHoldValue=playerValue(p,events,true);p.vorp=p.holdValue-(levels.get(p.positionId)??0);p.healthyVorp=p.healthyHoldValue-(levels.get(p.positionId)??0);p.buyLow=(p.recentLuck??0)<=-MODEL.luckThreshold&&!!p.minutesStable;
 const positional=all.filter(x=>x.positionId===p.positionId).map(x=>playerValue(x,events)-(levels.get(x.positionId)??0)).sort((a,b)=>b-a);
 const quartile=positional[Math.max(0,Math.ceil(positional.length/4)-1)]??0;
 if(p.injury&&(p.healthyVorp>0||protectedDrop(p,gamesPlayed,events.length))){p.holdVerdict='STASH-HOLD';p.holdReason=`Quality once fit${p.injury.returnDate?`; expected back ${p.injury.returnDate}`:'; no confirmed return date'}.`;}
 else if(protectedDrop(p,gamesPlayed,events.length)){p.holdVerdict='HOLD';p.holdReason=p.isNew?'New arrival: allow ten gameweeks to settle.':'Protected early-season track record.';}
 else if(p.vorp>0&&p.vorp>=quartile&&p.minutesStable){p.holdVerdict='CORE HOLD';p.holdReason='Top-quartile positional value with stable minutes.';}
 else if((p.recentLuck??0)>=MODEL.luckThreshold&&(p.recentPpg??0)>p.nowValue/Math.max(1,Math.min(events.length,3))+MODEL.sellHighPointsGap){p.holdVerdict='SELL-HIGH';p.holdReason='Recent goals and assists are running ahead of underlying chances.';}
 else {p.holdVerdict='HOLD';p.holdReason=p.vorp>0?'Above the available positional replacement.':'No sufficiently confident upgrade yet.';}
 }
}
export function recommendations(squad:InsightPlayer[],freeAgents:InsightPlayer[],events:number[],gamesPlayed:number):Recommendation[]{
 const candidates:Recommendation[]=[];
 for(const drop of squad){if(protectedDrop(drop,gamesPlayed,events.length))continue;
 for(const add of freeAgents.filter(a=>a.positionId===drop.positionId)){
 const gain=swapGain(squad,drop,add,events),confidence=swapConfidence(gain,add,drop,events);
 if(!gate(gain,confidence,drop.positionId))continue;
 candidates.push({add,drop,gain,confidence,reasons:[`Improves your starting XI and weighted bench by ${gain.toFixed(1)} discounted points.`,add.buyLow?'Buy-low: chance creation is ahead of recent returns.':`${add.minutesStable?'Stable':'Variable'} recent playing time; ${add.historySource==='season'?'season fallback':'recent gameweek evidence'}.`],caution:drop.established?`${drop.name} has a strong track record; this may not be a good long-term move.`:null});
 }}
 candidates.sort((a,b)=>b.gain-a.gain);const usedAdd=new Set<number>(),usedDrop=new Set<number>();
 return candidates.filter(r=>{if(usedAdd.has(r.add.playerId)||usedDrop.has(r.drop.playerId))return false;usedAdd.add(r.add.playerId);usedDrop.add(r.drop.playerId);return true;}).slice(0,6);
}
export function teamSd(squad:InsightPlayer[],event:number){return Math.sqrt(squad.reduce((s,p)=>s+(p.varianceByEvent?.[event]??0),0));}
export function matchupDelta(squad:InsightPlayer[],drop:InsightPlayer,add:InsightPlayer,matchups:Matchup[]){return matchups.filter(m=>m.opponent!==null).map(m=>{
 const opponent=m.opponent;if(!opponent)return {event:m.event,delta:0};
 // Preserve the published starting-lineup baseline for the first gameweek.
 const before=m.me.starters,after=before.map(p=>p.playerId===drop.playerId?add:p);
 const chosen=before.some(p=>p.playerId===drop.playerId)?after:before;
 const future=matchups[0]?.event===m.event?chosen:optimizeLineup(swapped(squad,drop,add),m.event).xi;
 const mean=future.reduce((s,p)=>s+(p.byEvent[m.event]??0),0),sd=Math.hypot(teamSd(future,m.event),opponent.sd??teamSd(opponent.starters,m.event));
 const next=sd>0?normalCdf((mean-opponent.expected)/sd):mean>opponent.expected?1:mean===opponent.expected?.5:0;
 return {event:m.event,delta:next-(m.winProbability??.5)};
 });}
export function countContenders(add:InsightPlayer,rivals:{entryId:number;teamName:string;squad:InsightPlayer[]}[],events:number[],gamesPlayed:number){return rivals.filter(r=>r.squad.some(drop=>drop.positionId===add.positionId&&!protectedDrop(drop,gamesPlayed,events.length)&&swapGain(r.squad,drop,add,events)>=(MODEL.gainThreshold[add.positionId]??.75))).length;}
export function findTrades(mine:InsightPlayer[],rivals:{entryId:number;teamName:string;squad:InsightPlayer[]}[],events:number[],gamesPlayed:number):TradeIdea[]{
 const result:TradeIdea[]=[];
 for(const rival of rivals)for(const give of mine){if(protectedDrop(give,gamesPlayed,events.length))continue;for(const receive of rival.squad){if(give.positionId!==receive.positionId||protectedDrop(receive,gamesPlayed,events.length))continue;
 const myGain=swapGain(mine,give,receive,events),theirGain=swapGain(rival.squad,receive,give,events);
 if(myGain>0&&theirGain>0)result.push({rivalEntryId:rival.entryId,rivalTeamName:rival.teamName,give,receive,myGain,theirGain});}}
 return result.sort((a,b)=>b.myGain+b.theirGain-a.myGain-a.theirGain).slice(0,5);
}
export type TradeVerdict = {myNow:number;myHold:number;theirHold:number;confidence:number;verdict:'good'|'even'|'bad';notes:string[]};
/** Evaluate a user-built trade (any number of players each side) on optimized squad value. */
export function evaluateTrade(mine:InsightPlayer[],theirs:InsightPlayer[],give:InsightPlayer[],receive:InsightPlayer[],nowEvents:number[],holdEvents:number[],gamesPlayed:number):TradeVerdict{
 const g=new Set(give.map(p=>p.playerId)),r=new Set(receive.map(p=>p.playerId));
 const myAfter=[...mine.filter(p=>!g.has(p.playerId)),...receive],theirAfter=[...theirs.filter(p=>!r.has(p.playerId)),...give];
 const myNow=teamValue(myAfter,nowEvents)-teamValue(mine,nowEvents),myHold=teamValue(myAfter,holdEvents)-teamValue(mine,holdEvents),theirHold=teamValue(theirAfter,holdEvents)-teamValue(theirs,holdEvents);
 const sd=Math.sqrt([...give,...receive].reduce((s,p)=>s+horizonVariance(p,holdEvents),0));
 const confidence=sd>0?normalCdf(myHold/sd):myHold>0?1:myHold<0?0:.5;
 const verdict=myHold>=1&&confidence>=MODEL.confidenceThreshold?'good':myHold<=-1?'bad':'even';
 const notes:string[]=[];
 for(let pos=1;pos<=4;pos++){const before=mine.filter(p=>p.positionId===pos).length,after=myAfter.filter(p=>p.positionId===pos).length;if(before!==after)notes.push(`Changes your ${['','GK','DEF','MID','FWD'][pos]} count from ${before} to ${after}.`);}
 if(!optimizeLineup(myAfter,holdEvents[0]??nowEvents[0]??1).complete)notes.push('You could not field a legal starting XI after this trade.');
 for(const p of give)if(protectedDrop(p,gamesPlayed,holdEvents.length))notes.push(`${p.name} is protected (track record, new arrival or quality injury); think twice before moving them.`);
 for(const p of receive)if(p.injury)notes.push(`${p.name} is injured${p.injury.returnDate?` (expected back ${p.injury.returnDate})`:''}; value assumes the projected return.`);
 if(theirHold<=0)notes.push('This trade makes their squad worse, so they may decline.');
 if(myNow<0&&myHold>0)notes.push('Costs you points in the next few gameweeks but pays off long term.');
 return {myNow,myHold,theirHold,confidence,verdict,notes};
}
