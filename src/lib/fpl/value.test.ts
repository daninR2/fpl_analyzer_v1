import {it,expect} from 'vitest';
import {playerValue,swapGain,protectedDrop,gate,replacementLevels,evaluateTrade} from './value';
import type {InsightPlayer} from './types';
const p=(id:number,pos:number,points:number):InsightPlayer=>({playerId:id,name:'P',team:'ARS',position:'DEF',positionId:pos,availability:1,news:'',form:0,xg90:0,xa90:0,minutesShare:1,byEvent:{1:points,2:points},fixtures:[],total:points*2,healthyTotal:points*2,established:false,isNew:false,priorInjured:false,injury:null,varianceByEvent:{1:4,2:4}});
const squad=[p(1,1,2),p(2,1,0),...Array.from({length:5},(_,i)=>p(10+i,2,i<3?5:0)),...Array.from({length:5},(_,i)=>p(20+i,3,4)),...Array.from({length:3},(_,i)=>p(30+i,4,3))];
it('bench improvement with no triggers is not a full player-total upgrade',()=>{expect(swapGain(squad,p(14,2,0),p(99,2,1),[1])).toBe(0);});
it('starter improvement changes optimized squad value',()=>{expect(swapGain(squad,p(10,2,5),p(99,2,8),[1])).toBe(3);});
it('discounts later weeks by .92',()=>{expect(playerValue(p(99,2,5),[1,2])).toBeCloseTo(9.6);});
it('uses second best free agent as replacement',()=>{expect(replacementLevels([p(1,2,10),p(2,2,7),p(3,2,1)],[1]).get(2)).toBe(7);});
it('new arrivals get ten GWs before drops',()=>{const arrival={...p(99,2,0),isNew:true};expect(protectedDrop(arrival,9,3)).toBe(true);expect(protectedDrop(arrival,10,3)).toBe(false);});
it('requires both gain and .55 confidence',()=>{expect(gate(1,.54,2)).toBe(false);expect(gate(.49,.9,2)).toBe(false);expect(gate(.5,.55,2)).toBe(true);});
it('trade calculator: getting a better same-position starter is good, worse is bad',()=>{
 const theirs=[p(50,2,9),p(51,2,1)];
 expect(evaluateTrade(squad,theirs,[squad[2]!],[theirs[0]!],[1],[1,2],20).verdict).toBe('good');
 expect(evaluateTrade(squad,theirs,[squad[2]!],[theirs[1]!],[1],[1,2],20).verdict).toBe('bad');
});
