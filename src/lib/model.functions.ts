import {createServerFn} from '@tanstack/react-start';
import {accuracyMetrics} from './fpl/accuracy';
export const getModelAccuracy=createServerFn({method:'GET'}).handler(async()=>{
 const {createClient}=await import('@supabase/supabase-js');
 const key=process.env['SUPABASE_PUBLISHABLE_KEY'];const url=process.env['SUPABASE_URL'];
 if(!key||!url)throw new Error('Model accuracy unavailable.');
 const client=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith('sb_')&&headers.get('Authorization')===`Bearer ${key}`)headers.delete('Authorization');headers.set('apikey',key);return fetch(input,{...init,headers});}}});
 const rows=[];
 for(let offset=0;offset<50000;offset+=1000){const {data,error}=await client.from('projection_log').select('position_id,xpts,pred_p60,actual_points,actual_p60,baseline_form,baseline_ppg').order('gw').order('player_id').range(offset,offset+999);if(error)throw new Error('Could not load model accuracy.');rows.push(...(data??[]));if((data?.length??0)<1000)break;}
 const normalized=rows.map(r=>({...r,xpts:Number(r.xpts),pred_p60:Number(r.pred_p60),actual_points:r.actual_points===null?null:Number(r.actual_points),actual_p60:r.actual_p60===null?null:Number(r.actual_p60),baseline_form:Number(r.baseline_form),baseline_ppg:Number(r.baseline_ppg)}));
 return {overall:accuracyMetrics(normalized),positions:[1,2,3,4].map(id=>({id,...accuracyMetrics(normalized.filter(r=>r.position_id===id))})),logged:rows.length};
});
