import { current,db,fail,isAdmin } from '../../server';
export const runtime='edge';export const dynamic='force-dynamic';
export async function GET(req:Request){try{let u=await current(req);if(!u||u.status!=='active')return fail('로그인이 필요해요.',401);let admin=isAdmin(u),id=u.id;
 let [ss,rr,hh,ww,tt,oldPhotos]=await Promise.all([
 admin?db().prepare("SELECT id,name,grade,username,role,status FROM users WHERE role='student' ORDER BY created_at DESC").all():Promise.resolve({results:[]}),
 db().prepare(`SELECT r.*,u.name studentName,u.grade FROM point_requests r JOIN users u ON r.student_id=u.id ${admin?'':'WHERE r.student_id=?'} ORDER BY r.requested_at DESC LIMIT 300`).bind(...(admin?[]:[id])).all(),
 db().prepare(`SELECT h.*,u.name studentName FROM point_history h JOIN users u ON h.student_id=u.id ${admin?'':'WHERE h.student_id=?'} ORDER BY h.created_at DESC LIMIT 600`).bind(...(admin?[]:[id])).all(),
 db().prepare(`SELECT r.*,u.name studentName,u.grade FROM reward_requests r JOIN users u ON r.student_id=u.id ${admin?'':'WHERE r.student_id=?'} ORDER BY r.requested_at DESC LIMIT 300`).bind(...(admin?[]:[id])).all(),db().prepare('SELECT key,value FROM settings').all(),
 admin?db().prepare("SELECT COUNT(*) count FROM point_requests WHERE photo_key IS NOT NULL AND requested_at<? AND status IN ('approved','rejected')").bind(new Date(Date.now()-90*86400000).toISOString()).first<{count:number}>():Promise.resolve(null)]);
 const camel=(row:Record<string,unknown>)=>Object.fromEntries(Object.entries(row).map(([key,value])=>[key.replace(/_([a-z])/g,(_,letter:string)=>letter.toUpperCase()),value]));
 return Response.json({user:u,students:ss.results.map(camel),requests:rr.results.map(camel),history:hh.results.map(camel),rewards:ww.results.map(camel),settings:Object.fromEntries(tt.results.map((x:any)=>[x.key,x.value])),oldPhotoCount:oldPhotos?.count||0},{headers:{'Cache-Control':'no-store'}})}catch(e){console.error(e);return fail('기록을 불러오지 못했어요.',500)}}
