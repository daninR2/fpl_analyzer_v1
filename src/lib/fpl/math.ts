import { MODEL } from './config';
export const clamp = (v:number,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
export function poisson(mean:number,k:number){let p=Math.exp(-Math.max(0,mean));for(let i=1;i<=k;i++)p*=mean/i;return p;}
export function poissonAtLeast(mean:number,k:number){let sum=0;for(let i=0;i<k;i++)sum+=poisson(mean,i);return clamp(1-sum);}
/** Exact Poisson expectation, including the tail beyond ten goals. */
export function concededExpectation(lambda:number){return lambda/2-(1-Math.exp(-2*lambda))/4;}
export function normalCdf(z:number){if(!Number.isFinite(z))return z>0?1:0;const x=Math.abs(z)/Math.SQRT2,t=1/(1+.3275911*x);const y=1-(((((1.061405429*t-1.453152027)*t+1.421413741)*t-.284496736)*t+.254829592)*t)*Math.exp(-x*x);return clamp((1+(z<0?-y:y))/2);}
export type Deadline = {id:number;deadline_time:string};
/** Infer a year relative to the first projected deadline, never today's machine clock. */
export function returnGameweek(text:string|null,events:Deadline[]):number|null {
 if(!text || !events.length)return null;
 const first=events[0];if(!first)return null;
 const anchor=new Date(first.deadline_time);
 let date:Date;
 if(/\b20\d{2}\b/.test(text)) date=new Date(text);
 else {date=new Date(`${text} ${anchor.getUTCFullYear()}`);if(Number.isFinite(+date)&&+date < +anchor-180*86400000)date=new Date(`${text} ${anchor.getUTCFullYear()+1}`);}
 if(!Number.isFinite(+date))return null;
 return events.find(e=>+new Date(e.deadline_time)>+date)?.id ?? 39;
}
export function availabilityCurve(status:string,chance:number|null,news:string,returnText:string|null,events:Deadline[]):Record<number,number>{
 const r=returnGameweek(returnText,events),result:Record<number,number>={};
 const suspended=Number(news.match(/suspended for\s+(\d+)/i)?.[1]??1);
 events.forEach((e,i)=>{
 let a=1;
 if(status==='u'||status==='n')a=0;
 else if(status==='s')a=r!==null?Number(e.id>=r):Number(i>=suspended);
 else if(status==='i'||(status==='d'&&r!==null)){
   if(r!==null){const delta=e.id-r;a=delta<0?0:(MODEL.returnRamp[Math.min(delta,2)]??1);}
   else a=(1-MODEL.unknownReturnDecay**(i+1))*MODEL.unknownReturnRamp;
 }else if(status==='d'){const c=clamp((chance??50)/100);a=c+(1-c)*(1-MODEL.doubtfulRecovery**i);}
 result[e.id]=a;
 });return result;
}
export function minutesModel(recent:{nEff:number;p60:number;pb:number},season:{p60:number;pb:number}){
 const n=recent.nEff,prior=MODEL.minutesPriorGames, p60=clamp((n*recent.p60+prior*season.p60)/(n+prior));
 const pb=clamp((n*recent.pb+prior*season.pb)/(n+prior),0,1-p60);
 return {p60,pb,p0:1-p60-pb,expectedMinutes:p60*MODEL.startMinutes+pb*MODEL.subMinutes};
}
export function fixtureVariance(c:{muG:number;muA:number;goalPoints:number;csProbability:number;csPoints:number;p60:number;pb:number;bonusMean:number;mean:number;availability:number}){
 const appearanceMean=c.pb+2*c.p60;
 const appearanceVariance=c.pb+4*c.p60-appearanceMean**2;
 const healthy=c.goalPoints**2*c.muG+9*c.muA+c.csProbability*(1-c.csProbability)*c.csPoints**2+Math.max(0,appearanceVariance)+MODEL.bonusVariance*Math.max(0,c.bonusMean);
 return Math.max(0,c.availability*healthy+c.availability*(1-c.availability)*c.mean**2);
}
