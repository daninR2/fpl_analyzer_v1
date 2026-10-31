import {it,expect} from 'vitest';
import {optimizeLineup} from './lineup';
const squad=(values:number[][])=>values.flatMap((vs,i)=>vs.map((v,j)=>({playerId:i*10+j,positionId:i+1,byEvent:{1:v}})));
it('enumerates formations instead of greedy core fill',()=>{const r=optimizeLineup(squad([[2,1],[1,1,1,9,8],[10,9,8,7,6],[5,4,3]]),1);expect(r.expected).toBe(73);expect(r.xi.filter(p=>p.positionId===2)).toHaveLength(3);expect(r.xi.filter(p=>p.positionId===3)).toHaveLength(5);expect(r.bench).toHaveLength(4);});
it('does not pretend a missing GK is a valid XI',()=>{const r=optimizeLineup(squad([[],[1,1,1,1,1],[1,1,1,1,1],[1,1,1]]),1);expect(r.complete).toBe(false);expect(r.xi.some(p=>p.positionId===1)).toBe(false);});
it('prefers healthy scorers over zero projected injured players',()=>{const r=optimizeLineup(squad([[0,3],[1,1,1,1,1],[1,1,1,1,1],[1,1,1]]),1);expect(r.xi.find(p=>p.positionId===1)?.playerId).toBe(1);});
