import { describe,it,expect } from 'vitest';
import {recentStats,snapshotDeltas,type PlayerHistory} from './recency';
const h=(event:number,minutes:number,xg=0):PlayerHistory=>({event,minutes,xg,xa:0,points:2,bonus:0,saves:0,defensiveContribution:0,goals:0,assists:0,yellowCards:0,redCards:0});
describe('recency',()=>{
 it('weights each GW by 0.85 to the age',()=>{const r=recentStats([h(1,90,1),h(2,90,0)],2);expect(r.xg90).toBeCloseTo(.85/1.85);expect(r.nEff).toBeCloseTo(1.85**2/(1+.85**2));});
 it('combines doubles before estimating minutes probabilities',()=>{expect(recentStats([h(2,30),h(2,40)],2).p60).toBe(1);});
 it('does not manufacture history from a first snapshot',()=>{expect(snapshotDeltas([])).toEqual([]);});
});
