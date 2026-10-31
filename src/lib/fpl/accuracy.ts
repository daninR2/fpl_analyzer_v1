export type AccuracyRow={position_id:number;xpts:number;pred_p60:number;actual_points:number|null;actual_p60:number|null;baseline_form:number;baseline_ppg:number};
export function accuracyMetrics(rows:AccuracyRow[]){
 const scored=rows.filter((r):r is AccuracyRow & {actual_points:number}=>r.actual_points!==null);
 const avg=(fn:(r:AccuracyRow & {actual_points:number})=>number)=>scored.length?scored.reduce((s,r)=>s+fn(r),0)/scored.length:null;
 return {count:scored.length,mae:avg(r=>Math.abs(r.xpts-r.actual_points)),bias:avg(r=>r.xpts-r.actual_points),formMae:avg(r=>Math.abs(r.baseline_form-r.actual_points)),ppgMae:avg(r=>Math.abs(r.baseline_ppg-r.actual_points)),calibration:[0,.2,.4,.6,.8].map(lo=>{const bin=scored.filter(r=>r.pred_p60>=lo&&(lo===.8?r.pred_p60<=1:r.pred_p60<lo+.2)&&r.actual_p60!==null);return {from:lo,to:lo+.2,count:bin.length,predicted:bin.length?bin.reduce((s,r)=>s+r.pred_p60,0)/bin.length:null,actual:bin.length?bin.reduce((s,r)=>s+(r.actual_p60??0),0)/bin.length:null};})};
}
