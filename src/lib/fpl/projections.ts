// Expected-points model for Draft FPL. Pure functions, no I/O.
//
// Team strength comes from aggregated player data (team xG per game, and
// goalkeeper xGC per 90). Each player's per-90 rates are shrunk toward a
// positional prior so low-minute players don't look like superstars, then
// scaled by the attacking/defensive strength of each upcoming opponent.

import priorSeason from "./prior-2025-26.json";
import { MODEL } from './config';
import { recentStats, type PlayerHistory } from './recency';
import { availabilityCurve, clamp, concededExpectation, fixtureVariance, minutesModel, normalCdf, poissonAtLeast, type Deadline } from './math';
import { optimizeLineup } from './lineup';

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
  red_cards?: number;
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
  sd?: number;
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
  /** Projected points over the window if fully fit. */
  healthyTotal: number;
  /** New to the Premier League (no meaningful 2025/26 minutes). */
  isNew: boolean;
  /** Missed a large part of 2025/26 (likely injury) but is a regular now; last season's numbers are ignored. */
  priorInjured: boolean;
  /** Currently injured/doubtful with a parsed return date, if FPL gave one. */
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

const POS=['','GKP','DEF','MID','FWD'];
const num=(v:unknown)=>Number(v)||0;
type PriorPlayer={minutes:number;points:number;xg:number;xa:number;xgc:number;cs:number};
type PriorTeam={xgPerGame:number;xgaPerGame:number;cleanSheets:number};
const playerPriors=priorSeason.players as Record<string,PriorPlayer>;
const teamPriors=priorSeason.teams as Record<string,PriorTeam>;
export function availability(e:RawElement){return e.status==='a'?1:e.chance_of_playing_next_round!==null?clamp(e.chance_of_playing_next_round/100):['i','s','u','n'].includes(e.status)?0:1;}
export function projectPlayers(opts:{elements:RawElement[];teams:{id:number;short_name:string}[];fixtures:RawFixture[];events:number[];gamesPlayed:number;deadlines?:Deadline[];histories?:Map<number,PlayerHistory[]>;historySources?:Map<number,string>}):{players:Map<number,PlayerProjection>;teamDifficulty:Map<string,number>}{
 const {elements,fixtures,events,gamesPlayed}=opts,gp=Math.max(1,gamesPlayed);
 const names=new Map(opts.teams.map(t=>[t.id,t.short_name]));
 const raw=opts.teams.map(t=>{const els=elements.filter(e=>e.team===t.id),gks=els.filter(e=>e.element_type===1);return {id:t.id,attack:els.reduce((s,e)=>s+num(e.expected_goals),0)/gp,defence:gks.reduce((s,e)=>s+num(e.expected_goals_conceded),0)/Math.max(1,gks.reduce((s,e)=>s+e.minutes,0)/90)};});
 const avgA=raw.reduce((s,t)=>s+t.attack,0)/Math.max(1,raw.length)||1.35,avgD=raw.reduce((s,t)=>s+t.defence,0)/Math.max(1,raw.length)||1.35;
 const w=gamesPlayed/(gamesPlayed+MODEL.teamPriorGames);
 const strength=new Map(raw.map(t=>{const prior=teamPriors[names.get(t.id)??''];return [t.id,{attack:w*t.attack+(1-w)*(prior?.xgPerGame??avgA),defence:w*t.defence+(1-w)*(prior?.xgaPerGame??avgD)}];}));
 type Fx={event:number;opp:number;home:boolean;lamFor:number;lamAgainst:number};const byTeam=new Map<number,Fx[]>();
 for(const f of fixtures){if(!events.includes(f.event))continue;const h=strength.get(f.team_h),a=strength.get(f.team_a);if(!h||!a)continue;
 const lamH=h.attack*a.defence/avgD*MODEL.homeAdvantage,lamA=a.attack*h.defence/avgD/MODEL.homeAdvantage;
 byTeam.set(f.team_h,[...(byTeam.get(f.team_h)??[]),{event:f.event,opp:f.team_a,home:true,lamFor:lamH,lamAgainst:lamA}]);
 byTeam.set(f.team_a,[...(byTeam.get(f.team_a)??[]),{event:f.event,opp:f.team_h,home:false,lamFor:lamA,lamAgainst:lamH}]);}
 const players=new Map<number,PlayerProjection>();
 for(const e of elements){
 const pos=e.element_type,goalPts=MODEL.goalPoints[pos]??0,csPts=MODEL.cleanSheetPoints[pos]??0,nineties=e.minutes/90;
 const rawPrior=playerPriors[String(e.code)],share=clamp(e.minutes/(gp*90));
 const priorInjured=!!rawPrior&&rawPrior.minutes>0&&rawPrior.minutes<1700&&gamesPlayed>=1&&share>=.6;
 const prior=priorInjured?undefined:rawPrior,isNew=!rawPrior||rawPrior.minutes<450;
 const priorN=Math.min((prior?.minutes??0)/90,MODEL.priorNineties);
 const recent=recentStats(opts.histories?.get(e.id)??[],gamesPlayed);
 const hasRecent=recent.count>0;
 const evidenceN=hasRecent?recent.nineties:nineties;
 const rate=(recentRate:number,total:unknown)=>hasRecent?recentRate:nineties>0?num(total)/nineties:0;
 const xp=MODEL.xgPrior[pos]??0,ap=MODEL.xaPrior[pos]??0;
 let xg90=(rate(recent.xg90,e.expected_goals)*evidenceN+(prior&&prior.minutes>0?prior.xg/prior.minutes*90:xp)*priorN+xp*MODEL.positionalPriorNineties)/(evidenceN+priorN+MODEL.positionalPriorNineties);
 const xa90=(rate(recent.xa90,e.expected_assists)*evidenceN+(prior&&prior.minutes>0?prior.xa/prior.minutes*90:ap)*priorN+ap*MODEL.positionalPriorNineties)/(evidenceN+priorN+MODEL.positionalPriorNineties);
 // Starts available in bootstrap; a meaningful prior protects zero-minute opening weeks.
 const seasonHistory=opts.histories?.get(e.id)??[];
 const seasonMinutes=new Map<number,number>();for(const h of seasonHistory.filter(h=>h.event<=gamesPlayed&&h.fit!==false))seasonMinutes.set(h.event,(seasonMinutes.get(h.event)??0)+h.minutes);
 const seasonDen=seasonMinutes.size;
 const seasonP60=seasonDen ? [...seasonMinutes.values()].filter(m=>m>=60).length/seasonDen : nineties>0?clamp((e.starts??e.minutes/MODEL.startMinutes)/gp):clamp((prior?.minutes??0)/(38*MODEL.startMinutes));
 const seasonPb=seasonDen ? [...seasonMinutes.values()].filter(m=>m>0&&m<60).length/seasonDen : clamp((share-seasonP60*MODEL.startMinutes/90)/(MODEL.subMinutes/90),0,1-seasonP60);
 const minutes=minutesModel(recent,{p60:seasonP60,pb:seasonPb});
 if(e.penalties_order===1&&minutes.expectedMinutes>0)xg90=Math.max(xg90,MODEL.penaltyFloor*90/minutes.expectedMinutes);
 const news=e.news??'',injury=availability(e)<1&&['i','d','s'].includes(e.status)?{returnDate:returnDate(news)}:null;
 const deadlines=events.map(id=>opts.deadlines?.find(d=>d.id===id)??{id,deadline_time:''});
 const av=availabilityCurve(e.status,e.chance_of_playing_next_round,news,injury?.returnDate??null,deadlines);
 const bonus=hasRecent?recent.bonus:e.bonus/gp,ppg=hasRecent?recent.ppg:num(e.points_per_game);
 const priorPpg=prior&&prior.minutes>=450?prior.points/Math.max(prior.minutes/90,1):ppg;
 const blendedPpg=evidenceN>0?(ppg*evidenceN+priorPpg*priorN)/(evidenceN+priorN):priorPpg;
 const saves=rate(recent.saves90,e.saves)||(pos===1?2.5:0),dc=rate(recent.dc90,e.defensive_contribution),yellow=rate(recent.yellow90,e.yellow_cards),red=(num(e.red_cards)+MODEL.positionalPriorNineties*.01)/(nineties+MODEL.positionalPriorNineties);
 const redRate=hasRecent?(recent.red90*evidenceN+red*MODEL.minutesPriorGames)/(evidenceN+MODEL.minutesPriorGames):red;
 const byEvent:Record<number,number>={},variance:Record<number,number>={},healthy:Record<number,number>={},p60:Record<number,number>={},fixturesOut:FixtureProjection[]=[],healthySquares:Record<number,number>={};
 for(const ev of events){byEvent[ev]=0;variance[ev]=0;healthy[ev]=0;p60[ev]=minutes.p60*(av[ev]??1);}
 for(const fx of byTeam.get(e.team)??[]){const own=strength.get(e.team),ratio=own?.attack?fx.lamFor/own.attack:1,mins90=minutes.expectedMinutes/90;
 const muG=xg90*ratio*mins90,muA=xa90*ratio*mins90,pCS=Math.exp(-fx.lamAgainst)*minutes.p60,bonusMean=bonus*(pos>=3?Math.sqrt(clamp(ratio,.7,1.3)):1);
 let mean=minutes.pb+2*minutes.p60+goalPts*muG+3*muA+pCS*csPts+bonusMean-yellow*mins90-3*redRate*mins90;
 if(pos<=2)mean-=concededExpectation(fx.lamAgainst)*minutes.p60;
 if(pos===1)mean+=saves*fx.lamAgainst/avgA/3*mins90;
 if(pos>=2)mean+=2*poissonAtLeast(dc*mins90,MODEL.defensiveThreshold[pos]??12)*minutes.p60;
 if(e.minutes>=180)mean=(1-MODEL.ppgBlend)*mean+MODEL.ppgBlend*blendedPpg*clamp(ratio,.8,1.2);
 mean=Math.max(0,mean);const a=av[fx.event]??1,points=mean*a;
 const v=fixtureVariance({muG,muA,goalPoints:goalPts,csProbability:pCS,csPoints:csPts,p60:minutes.p60,pb:minutes.pb,bonusMean,mean,availability:a});
 healthySquares[fx.event]=(healthySquares[fx.event]??0)+mean*mean;
 byEvent[fx.event]=(byEvent[fx.event]??0)+points;healthy[fx.event]=(healthy[fx.event]??0)+mean;variance[fx.event]=(variance[fx.event]??0)+v;
 const diff=fx.lamFor-fx.lamAgainst,difficulty=diff>.8?1:diff>.25?2:diff>-.25?3:diff>-.8?4:5;
 fixturesOut.push({event:fx.event,opponent:names.get(fx.opp)??'?',home:fx.home,difficulty,xPts:round(points),sd:round(Math.sqrt(v))});}
 // Availability is shared across fixtures in a double GW, adding its covariance.
 for(const ev of events){const a=av[ev]??1;variance[ev]=(variance[ev]??0)+a*(1-a)*((healthy[ev]??0)**2-(healthySquares[ev]??0));}
 const discounted=(record:Record<number,number>,limit=events.length)=>events.slice(0,limit).reduce((s,ev,i)=>s+MODEL.discount**i*(record[ev]??0),0);
 players.set(e.id,{playerId:e.id,name:e.web_name,team:names.get(e.team)??'',teamId:e.team,position:POS[pos]??'',positionId:pos,availability:availability(e),news,form:num(e.form),totalPoints:e.total_points,xg90:round(xg90,2),xa90:round(xa90,2),minutesShare:round(minutes.expectedMinutes/90,2),byEvent,fixtures:fixturesOut,total:round(Object.values(byEvent).reduce((s,v)=>s+v,0)),healthyTotal:round(Object.values(healthy).reduce((s,v)=>s+v,0)),established:!!prior&&prior.minutes>=1200&&prior.points>=([0,85,90,100,95][pos]??100),isNew,priorInjured,injury,availabilityByEvent:av,varianceByEvent:variance,sdByEvent:Object.fromEntries(events.map(ev=>[ev,Math.sqrt(variance[ev]??0)])),p60ByEvent:p60,healthyByEvent:healthy,sd:Math.sqrt(Object.values(variance).reduce((s,v)=>s+v,0)),recentLuck:hasRecent?recent.luck:0,recentPpg:ppg,historySource:opts.historySources?.get(e.id)??'season',minutesStable:minutes.p60>=MODEL.stableMinutes,nowValue:discounted(byEvent,MODEL.nowHorizon),holdValue:discounted(byEvent),healthyHoldValue:discounted(healthy)});
 }
 const teamDifficulty=new Map<string,number>();for(const [id,s]of strength)teamDifficulty.set(names.get(id)??'',round(s.attack-s.defence,2));return {players,teamDifficulty};
}
export function returnDate(news:string):string|null {return news.match(/(?:expected back|until)\s+([^.,;]+)/i)?.[1]?.trim()??null;}
export function round(n:number,dp=1){return Math.round(n*10**dp)/10**dp;}
export function bestEleven<T extends {playerId:number;positionId:number;byEvent:Record<number,number>}>(players:T[],event:number){return optimizeLineup(players,event).xi;}
export function winProbability(a:number,b:number,sdA=0,sdB=0){const sd=Math.hypot(sdA,sdB);return sd>0?normalCdf((a-b)/sd):a===b?.5:a>b?1:0;}
