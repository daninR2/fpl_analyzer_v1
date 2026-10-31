import {describe,it,expect} from 'vitest';
import {availabilityCurve,concededExpectation,fixtureVariance,minutesModel,poisson,returnGameweek} from './math';
const events=[{id:10,deadline_time:'2026-10-31T11:00:00Z'},{id:11,deadline_time:'2026-11-07T11:00:00Z'},{id:12,deadline_time:'2026-11-14T11:00:00Z'},{id:13,deadline_time:'2026-11-21T11:00:00Z'}];
describe('fixture math',()=>{
 it('matches exact Poisson goals conceded including tail',()=>{for(const lambda of [0,.5,2,5,12]){let exact=0;for(let g=2;g<100;g++)exact+=Math.floor(g/2)*poisson(lambda,g);expect(concededExpectation(lambda)).toBeCloseTo(exact,10);}});
 it('maps an inferred-year return to the first deadline after it',()=>{expect(returnGameweek('5 Nov',events)).toBe(11);expect(returnGameweek('nonsense',events)).toBeNull();expect(returnGameweek('23 Nov',events)).toBe(39);});
 it('ramps a dated injury through 0, .7, .9, 1',()=>{expect(availabilityCurve('i',0,'','5 Nov',events)).toEqual({10:0,11:.7,12:.9,13:1});});
 it('doubtful recovery starts at c and closes half the gap each week',()=>{expect(availabilityCurve('d',50,'',null,events)).toEqual({10:.5,11:.75,12:.875,13:.9375});});
 it('unknown injury uses 0.75 decay and .85 ramp',()=>{expect(availabilityCurve('i',0,'',null,events)[10]).toBeCloseTo(.25*.85);});
 it('suspensions and departed players have distinct curves',()=>{expect(availabilityCurve('s',0,'Suspended for 2',null,events)).toEqual({10:0,11:0,12:1,13:1});expect(Object.values(availabilityCurve('u',null,'',null,events))).toEqual([0,0,0,0]);});
 it('shrinks minutes toward three season games',()=>{const m=minutesModel({nEff:3,p60:1,pb:0},{p60:0,pb:1});expect(m.p60).toBe(.5);expect(m.pb).toBe(.5);expect(m.expectedMinutes).toBe(53);});
 it('calculates Poisson, Bernoulli and availability variance',()=>{const v=fixtureVariance({muG:.2,muA:.3,goalPoints:5,csProbability:.4,csPoints:1,p60:.6,pb:.2,bonusMean:1,mean:4,availability:.5});expect(v).toBeCloseTo(.5*(25*.2+9*.3+.4*.6+( .2+4*.6-1.4**2)+.9)+.25*16);});
});
