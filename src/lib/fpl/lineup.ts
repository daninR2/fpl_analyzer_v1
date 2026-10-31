/** Exact legal formation search. Deterministic ties use player IDs. */
export type LineupPlayer = { playerId:number; positionId:number; byEvent:Record<number,number> };
export function optimizeLineup<T extends LineupPlayer>(players:T[],event:number):{xi:T[];bench:T[];expected:number;complete:boolean}{
 const unique=[...new Map(players.map(p=>[p.playerId,p])).values()];
 const by=(pos:number)=>unique.filter(p=>p.positionId===pos).sort((a,b)=>(b.byEvent[event]??0)-(a.byEvent[event]??0)||a.playerId-b.playerId);
 const g=by(1),d=by(2),m=by(3),f=by(4);let best:T[]=[];let score=-Infinity;
 for(let nd=3;nd<=5;nd++)for(let nm=2;nm<=5;nm++){
   const nf=10-nd-nm;if(nf<1||nf>3||!g.length||d.length<nd||m.length<nm||f.length<nf)continue;
   const xi=[...g.slice(0,1),...d.slice(0,nd),...m.slice(0,nm),...f.slice(0,nf)];
   const total=xi.reduce((s,p)=>s+(p.byEvent[event]??0),0);if(total>score){best=xi;score=total;}
 }
 // Incomplete squad: explicit incomplete result, never fabricate a goalkeeper.
 if(!best.length){best=[...g.slice(0,1),...d.slice(0,5),...m.slice(0,5),...f.slice(0,3)].sort((a,b)=>(b.byEvent[event]??0)-(a.byEvent[event]??0)).slice(0,11);score=best.reduce((s,p)=>s+(p.byEvent[event]??0),0);}
 const ids=new Set(best.map(p=>p.playerId));return {xi:best,bench:unique.filter(p=>!ids.has(p.playerId)),expected:score,complete:best.length===11&&best.some(p=>p.positionId===1)&&best.filter(p=>p.positionId===2).length>=3&&best.filter(p=>p.positionId===3).length>=2&&best.some(p=>p.positionId===4)};
}
