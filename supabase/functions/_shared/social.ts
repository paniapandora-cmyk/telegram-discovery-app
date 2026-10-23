// The caller supplies identity derived exclusively from verified Telegram initData.
export async function socialRoute(request: Request, url: URL, path: string, userId: string, rest: any, rpc: any) {
 const uuid = (v: unknown) => typeof v === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
 let body: any = {};
 if (request.method !== 'GET') {
   const text = await request.text();
   if (text.length > 12000) return {status:413,data:{ok:false,error:'request_too_large'}};
   try { body=JSON.parse(text); } catch { return {status:400,data:{ok:false,error:'invalid_json'}}; }
 }
 const contentId = request.method==='GET' ? url.searchParams.get('content_id') : body?.content_id;
 const fail = (error:string,status=400) => ({status,data:{ok:false,error}});
 if (!uuid(contentId)) return fail('invalid_content_id');
 const content = await rest(`contents?select=id,rights_status,moderation_status&id=eq.${contentId}&limit=1`);
 if (!content.length || content[0].rights_status==='REMOVED' || ['REPORTED','REJECTED'].includes(content[0].moderation_status)) return fail('post_not_found',404);
 if (path==='/social' && request.method==='GET') return {status:200,data:{ok:true,...(await rpc('discovery_social_stats_v1',{p_user_id:userId,p_ids:[contentId]}))[0]}};
 if (path==='/like' && request.method==='POST') {
   if (typeof body.liked!=='boolean') return fail('invalid_liked');
   if (body.liked) await rest('discovery_likes?on_conflict=content_id,user_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({user_id:userId,content_id:contentId})});
   else await rest(`discovery_likes?content_id=eq.${contentId}&user_id=eq.${userId}`,{method:'DELETE'});
   return {status:200,data:{ok:true,...(await rpc('discovery_social_stats_v1',{p_user_id:userId,p_ids:[contentId]}))[0]}};
 }
 if (path==='/comments' && request.method==='GET') {
   const before=url.searchParams.get('before'), beforeId=url.searchParams.get('before_id');
   if ((before || beforeId) && (!before || !Number.isFinite(Date.parse(before)) || !uuid(beforeId))) return fail('invalid_cursor');
   const items=await rpc('discovery_comments_page_v1',{p_user_id:userId,p_content_id:contentId,p_before:before,p_before_id:beforeId});
   return {status:200,data:{ok:true,items:items.slice(0,20),has_more:items.length>20,...(await rpc('discovery_social_stats_v1',{p_user_id:userId,p_ids:[contentId]}))[0]}};
 }
 if (path==='/comments' && request.method==='POST') {
   if(typeof body.text!=='string'|| !body.text.trim() || [...body.text.trim()].length>1500 || !uuid(body.request_id) || (body.parent_id!=null&&!uuid(body.parent_id))) return fail('invalid_comment');
   try {
    const id=await rpc('discovery_comment_write_v1',{p_user_id:userId,p_content_id:contentId,p_body:body.text.trim(),p_request_id:body.request_id,p_parent_id:body.parent_id||null});
    return {status:201,data:{ok:true,id}};
   } catch(error) { if(/comment_rate_limit/.test(String(error))) return fail('comment_rate_limit',429); if(/invalid_parent|invalid_comment/.test(String(error))) return fail('invalid_comment'); throw error; }
 }
 if ((path==='/comments' && request.method==='DELETE') || (path==='/comments/report' && request.method==='POST')) {
   if(!uuid(body.comment_id)) return fail('invalid_comment_id');
   if(path==='/comments') {
    const rows=await rest(`discovery_comments?id=eq.${body.comment_id}&content_id=eq.${contentId}&user_id=eq.${userId}&deleted_at=is.null`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({deleted_at:new Date().toISOString(),body:'نظر حذف شده'})});
    if(!rows.length) return fail('comment_not_found',404);
   } else {
    const rows=await rest(`discovery_comments?select=id&id=eq.${body.comment_id}&content_id=eq.${contentId}&deleted_at=is.null`);
    if(!rows.length) return fail('comment_not_found',404);
    await rest('discovery_comment_reports?on_conflict=comment_id,user_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=minimal'},body:JSON.stringify({comment_id:body.comment_id,user_id:userId})});
   }
   return {status:200,data:{ok:true}};
 }
 return fail('not_found',404);
}
