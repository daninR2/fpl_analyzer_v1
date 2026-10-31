import {createFileRoute} from '@tanstack/react-router';
import {authenticateCronRequest} from '@/integrations/supabase/cron-auth';
export const Route=createFileRoute('/api/public/jobs/model-tracking')({server:{handlers:{POST:async({request})=>{
 const failure=await authenticateCronRequest(request);if(failure)return failure;
 const {trackModel}=await import('@/lib/fpl/tracking.server');
 try{return Response.json(await trackModel());}catch(error){console.error('Model tracking failed',error);return Response.json({error:'Model tracking unavailable'},{status:503});}
}}}});
